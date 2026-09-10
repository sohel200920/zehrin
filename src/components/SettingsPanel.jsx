export const BACKGROUND_OPTIONS = [
    { id: "none", label: "None (solid color)", path: null },
    { id: "bg1", label: "Background 1", path: "/assets/backgrounds/bg1.jpg" },
    { id: "bg2", label: "Background 2", path: "/assets/backgrounds/bg2.jpg" },
    { id: "bg3", label: "Background 3", path: "/assets/backgrounds/bg3.jpg" }
];

export default function SettingsPanel({ theme, setTheme, background, setBackground, onClose }) {
    return (
        <div className="settings-overlay" onClick={onClose}>
            <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
                <div className="settings-header">
                    <h3>Settings</h3>
                    <button onClick={onClose}>✕</button>
                </div>

                <div className="settings-section">
                    <h4>Theme</h4>
                    <div className="settings-options">
                        <label>
                            <input type="radio" name="theme" checked={theme === "dark"} onChange={() => setTheme("dark")} />
                            Dark
                        </label>
                        <label>
                            <input type="radio" name="theme" checked={theme === "light"} onChange={() => setTheme("light")} />
                            Light
                        </label>
                    </div>
                </div>

                <div className="settings-section">
                    <h4>Background Image</h4>
                    <div className="settings-options">
                        {BACKGROUND_OPTIONS.map((opt) => (
                            <label key={opt.id}>
                                <input
                                    type="radio"
                                    name="background"
                                    checked={background === opt.id}
                                    onChange={() => setBackground(opt.id)}
                                />
                                {opt.label}
                            </label>
                        ))}
                    </div>
                    <p className="settings-hint">
                        Naya background daalne ke liye image ko <code>public/assets/backgrounds/</code> mein rakho
                        aur is file ki <code>BACKGROUND_OPTIONS</code> list mein ek entry add karo.
                    </p>
                </div>
            </div>
        </div>
    );
}