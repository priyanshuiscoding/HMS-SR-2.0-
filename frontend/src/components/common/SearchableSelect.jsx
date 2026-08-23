import { useEffect, useMemo, useRef, useState } from "react";

export function SearchableSelect({
  value,
  customValue = "",
  options = [],
  onChange,
  onCustomValueChange,
  placeholder = "Search and select",
  emptyLabel = "No matching options",
  getOptionValue = (option) => option?.id ?? "",
  getOptionLabel = (option) => option?.name ?? "",
  getOptionMeta = () => "",
  getSearchText,
  loadOptions,
  disabled = false,
  limit = 30
}) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [remoteOptions, setRemoteOptions] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const requestIdRef = useRef(0);
  const loadOptionsRef = useRef(loadOptions);
  loadOptionsRef.current = loadOptions;
  const availableOptions = remoteOptions ?? options;

  const selectedOption = useMemo(
    () => [...availableOptions, ...options].find((option) => String(getOptionValue(option)) === String(value)),
    [availableOptions, getOptionValue, options, value]
  );
  const selectedLabel = selectedOption ? getOptionLabel(selectedOption) : customValue;
  const searchTerm = query.trim().toLowerCase();

  useEffect(() => {
    if (selectedOption) {
      setQuery(selectedLabel);
    } else if (customValue) {
      setQuery(customValue);
    } else if (!value) {
      setQuery("");
    }
  }, [customValue, selectedLabel, selectedOption, value]);

  useEffect(() => {
    if (!loadOptionsRef.current || !isOpen) {
      return undefined;
    }

    const term = query.trim();
    if (!term) {
      requestIdRef.current += 1;
      setRemoteOptions(null);
      setIsLoading(false);
      return undefined;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    const timeoutId = window.setTimeout(async () => {
      setIsLoading(true);
      try {
        const loadedOptions = await loadOptionsRef.current(term);
        if (requestIdRef.current === requestId) {
          setRemoteOptions(Array.isArray(loadedOptions) ? loadedOptions : []);
        }
      } catch {
        if (requestIdRef.current === requestId) {
          setRemoteOptions([]);
        }
      } finally {
        if (requestIdRef.current === requestId) {
          setIsLoading(false);
        }
      }
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [isOpen, query]);

  const filteredOptions = useMemo(() => {
    const visibleOptions = !searchTerm
      ? availableOptions
      : availableOptions.filter((option) => {
        const text = getSearchText
          ? getSearchText(option)
          : [getOptionLabel(option), getOptionMeta(option)].filter(Boolean).join(" ");
        return text.toLowerCase().includes(searchTerm);
      });

    return visibleOptions.slice(0, limit);
  }, [availableOptions, getOptionLabel, getOptionMeta, getSearchText, limit, searchTerm]);

  const handleInputChange = (event) => {
    const nextQuery = event.target.value;
    setQuery(nextQuery);
    setIsOpen(true);
    if (value) {
      onChange("");
    }
    onCustomValueChange?.(nextQuery);
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
          {!filteredOptions.length ? <div className="searchable-select-empty">{isLoading ? "Searching..." : emptyLabel}</div> : null}
        </div>
      ) : null}
    </div>
  );
}
