from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
import logging
from .tle_fetcher import tle_fetcher

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class TLEScheduler:
    """Schedule automatic TLE updates"""
    
    def __init__(self):
        self.scheduler = BackgroundScheduler()
    
    def start(self):
        """Start the scheduler"""
        # Update TLEs daily at 2 AM UTC
        self.scheduler.add_job(
            func=self._update_all_tles,
            trigger=CronTrigger(hour=2, minute=0),
            id='daily_tle_update',
            name='Update TLEs for all satellites',
            replace_existing=True
        )
        
        # Also update on startup
        self.scheduler.add_job(
            func=self._update_all_tles,
            id='startup_tle_update',
            name='Update TLEs on startup'
        )
        
        self.scheduler.start()
        logger.info("TLE scheduler started - daily updates at 02:00 UTC")
    
    def stop(self):
        """Stop the scheduler"""
        self.scheduler.shutdown()
        logger.info("TLE scheduler stopped")
    
    def _update_all_tles(self):
        """Update TLEs for all satellites"""
        logger.info("Running scheduled TLE update...")
        try:
            success, fail = tle_fetcher.update_all_satellites()
            logger.info(f"TLE update completed: {success} success, {fail} failed")
        except Exception as e:
            logger.error(f"TLE update failed: {e}")

tle_scheduler = TLEScheduler()