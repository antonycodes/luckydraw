export const DrawModeSelect = ({ sequential, disabled, onChange }: {
    sequential: boolean;
    disabled: boolean;
    onChange: (value: boolean) => void;
}) => (
    <fieldset disabled={disabled} className="mb-3">
        <legend className="mb-2 text-sm font-semibold text-gray-700">Cách quay nhiều người</legend>
        <div className="grid grid-cols-2 gap-2">
            {[{ value: false, label: 'Quay đồng thời' }, { value: true, label: 'Quay lần lượt' }].map(option => (
                <label key={option.label} className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl border px-2 py-3 text-sm font-semibold ${sequential === option.value ? 'border-red-700 bg-red-50 text-red-700' : 'border-gray-300 bg-white text-gray-700'} ${disabled ? 'opacity-50' : ''}`}>
                    <input type="radio" name="multi-draw-mode" checked={sequential === option.value} onChange={() => onChange(option.value)} className="accent-red-600" />
                    {option.label}
                </label>
            ))}
        </div>
    </fieldset>
);
