import { useEffect, useMemo, useState } from "react";

export function SearchableSelect({
  value,
  options = [],
  onChange,
  placeholder = "Search and select",
  emptyLabel = "No matching options",
  getOptionValue = (option) => option?.id ?? "",
  getOptionLabel = (option) => option?.name ?? "",
  getOptionMeta = () => "",
  getSearchText,
  disabled = false,
  limit = 30
}) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const selectedOption = useMemo(
    () => options.find((option) => String(getOptionValue(option)) === String(value)),
    [getOptionValue, options, value]
  );
  const selectedLabel = selectedOption ? getOptionLabel(selectedOption) : "";
  const searchTerm = query.trim().toLowerCase();

  useEffect(() => {
    if (selectedOption) {
      setQuery(selectedLabel);
    } else if (!value) {
      setQuery("");
    }
  }, [selectedLabel, selectedOption, value]);

  const filteredOptions = useMemo(() => {
    const visibleOptions = !searchTerm
      ? options
      : options.filter((option) => {
        const text = getSearchText
          ? getSearchText(option)
          : [getOptionLabel(option), getOptionMeta(option)].filter(Boolean).join(" ");
        return text.toLowerCase().includes(searchTerm);
      });

    return visibleOptions.slice(0, limit);
  }, [getOptionLabel, getOptionMeta, getSearchText, limit, options, searchTerm]);

  const handleInputChange = (event) => {
    setQuery(event.target.value);
    setIsOpen(true);
    if (value) {
      onChange("");
    }
  };

  const handleSelect = (option) => {
    const nextValue = getOptionValue(option);
    setQuery(getOptionLabel(option));
    setIsOpen(false);
    onChange(nextValue, option);
  };

  return (
    <div className="searchable-select">
      <input
        value={query}
        onChange={handleInputChange}
        onFocus={() => !disabled && setIsOpen(true)}
        onBlur={() => window.setTimeout(() => setIsOpen(false), 140)}
        placeholder={placeholder}
        autoComplete="off"
        disabled={disabled}
      />
      {isOpen && !disabled ? (
        <div className="searchable-select-menu">
          {filteredOptions.map((option) => {
            const optionValue = getOptionValue(option);
            const meta = getOptionMeta(option);
            return (
              <button
                key={optionValue}
                className="searchable-select-option"
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => handleSelect(option)}
              >
                <strong>{getOptionLabel(option)}</strong>
                {meta ? <span>{meta}</span> : null}
              </button>
            );
          })}
          {!filteredOptions.length ? <div className="searchable-select-empty">{emptyLabel}</div> : null}
        </div>
      ) : null}
    </div>
  );
}
