type ConfirmModalProps = {
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm: () => void;
    onCancel: () => void;
};

export default function ConfirmModal({
    title,
    message,
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    onConfirm,
    onCancel,
}: ConfirmModalProps) {
    return (
        <div className="modal-backdrop">
            <div className="modal card">
                <h3>{title}</h3>

                <p>{message}</p>

                <div className="modal-actions">
                    <button
                        type="button"
                        className="btn secondary"
                        onClick={onCancel}
                    >
                        {cancelLabel}
                    </button>

                    <button
                        type="button"
                        className="btn danger"
                        onClick={onConfirm}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
