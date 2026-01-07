type FeedbackModalProps = {
    title?: string;
    message: string;
    onClose: () => void;
};

export default function FeedbackModal({
    title = "Success",
    message,
    onClose,
}: FeedbackModalProps) {
    return (
        <div className="modal-backdrop">
            <div className="modal card">
                <h3>{title}</h3>

                <p>{message}</p>

                <div className="modal-actions">
                    <button
                        type="button"
                        className="btn primary"
                        onClick={onClose}
                    >
                        OK
                    </button>
                </div>
            </div>
        </div>
    );
}
