import React from "react";
import { toast } from "react-toastify";

export function showConfirmToast(message) {
    return new Promise((resolve) => {
        const toastId = toast.info(
            ({ closeToast }) => (
                <div style={{ textAlign: "center" }}>
                    <div style={{ marginBottom: "10px" }}>{message}</div>

                    <button
                        style={{
                            marginRight: "10px",
                            padding: "6px 14px",
                            background: "#4CAF50",
                            color: "white",
                            border: "none",
                            borderRadius: "6px",
                            cursor: "pointer",
                            position:"top-center"

                        }}
                        onClick={() => {
                            resolve(true);
                            toast.dismiss(toastId);
                        }}
                    >
                        Evet
                    </button>

                    <button
                        style={{
                            padding: "6px 14px",
                            background: "#d9534f",
                            color: "white",
                            border: "none",
                            borderRadius: "6px",
                            cursor: "pointer"
                        }}
                        onClick={() => {
                            resolve(false);
                            toast.dismiss(toastId);
                        }}
                    >
                        Hayır
                    </button>
                </div>
            ),
            {
                autoClose: false,
                closeOnClick: false,
                closeButton: false,
                draggable: false,
            }
        );
    });
}

export function showInputToast(message, dateLabel = "Durdurma tarihi:", withText = true) {
    return new Promise((resolve) => {
        let userInput = "";
        // Varsayılan durdurma tarihi: şu an (yerel saat, datetime-local formatında)
        const nowLocal = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
        let dateInput = nowLocal;

        const toastId = toast.info(
            ({ closeToast }) => (
                <div style={{ textAlign: "center" }}>
                    <div style={{ marginBottom: "10px" }}>{message}</div>

                    {withText && <input
                        type="text"
                        placeholder="Duraklama sebebi..."
                        style={{
                            width: "90%",
                            padding: "8px",
                            marginBottom: "10px",
                            borderRadius: "6px",
                            border: "1px solid #ccc",
                        }}
                        onChange={(e) => (userInput = e.target.value)}
                    />}

                    <div style={{ marginBottom: "4px" }}>{dateLabel}</div>
                    <input
                        type="datetime-local"
                        defaultValue={nowLocal}
                        max={nowLocal}
                        style={{
                            width: "90%",
                            padding: "8px",
                            marginBottom: "10px",
                            borderRadius: "6px",
                            border: "1px solid #ccc",
                        }}
                        onChange={(e) => (dateInput = e.target.value)}
                    />

                    <button
                        style={{
                            marginRight: "10px",
                            padding: "6px 14px",
                            background: "#4CAF50",
                            color: "white",
                            border: "none",
                            borderRadius: "6px",
                            cursor: "pointer"
                        }}
                        onClick={() => {
                            resolve({ text: userInput || "", date: dateInput });
                            toast.dismiss(toastId);
                        }}
                    >
                        Kaydet
                    </button>

                    <button
                        style={{
                            padding: "6px 14px",
                            background: "#d9534f",
                            color: "white",
                            border: "none",
                            borderRadius: "6px",
                            cursor: "pointer"
                        }}
                        onClick={() => {
                            resolve(null); // user cancelled
                            toast.dismiss(toastId);
                        }}
                    >
                        İptal
                    </button>
                </div>
            ),
            {
                autoClose: false,
                closeOnClick: false,
                closeButton: false,
                draggable: false,
            }
        );
    });
}
