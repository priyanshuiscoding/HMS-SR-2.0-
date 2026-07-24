import { useMemo, useState } from "react";

/**
 * Search-and-add picker in the style of LinkedIn's skills field: type to filter a
 * master list, click a suggestion to add it, and selected entries render as
 * removable chips below the input. With allowCustom the typed text can also be
 * added as-is when nothing in the master list matches.
 */
export function MultiSelectPicker({
  value = [],
  options = [],
  onChange,
  placeholder = "Search and add",
  emptyLabel = "No matching options",
  emptySelectionLabel = "Nothing added yet",
  getOptionValue = (option) => option?.id ?? "",
  getOptionLabel = (option) => option?.name ?? "",
  getOptionMeta = () => "",
  getSearchText,
  allowCustom = false,
  createOption = (name) => ({ id: "", name }),
  disabled = false,
  limit = 30
}) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  // Typed entries have no id until the server saves them, so identity falls back
  // to the label to keep keys stable and de-duplication working.
  const keyOf = (item) => String(getOptionValue(item) || getOptionLabel(item)).trim().toLowerCase();

  const selectedKeys = useMemo(() => new Set(value.map(keyOf)), [value]);
  const trimmedQuery = query.trim();
  const searchTerm = trimmedQuery.toLowerCase();

  const filteredOptions = useMemo(() => {
    const available = options.filter((option) => !selectedKeys.has(keyOf(option)));
    const visible = !searchTerm
      ? available
      : available.filter((option) => {
        const text = getSearchText
          ? getSearchText(option)
          : [getOptionLabel(option), getOptionMeta(option)].filter(Boolean).join(" ");
        return text.toLowerCase().includes(searchTerm);
      });

    return visible.slice(0, limit);
  }, [getOptionLabel, getOptionMeta, getSearchText, limit, options, searchTerm, selectedKeys]);

  const hasExactMatch = useMemo(
    () =>
      Boolean(searchTerm) &&
      (options.some((option) => getOptionLabel(option).trim().toLowerCase() === searchTerm) ||
        selectedKeys.has(searchTerm)),
    [getOptionLabel, options, searchTerm, selectedKeys]
  );
  const canAddCustom = allowCustom && Boolean(trimmedQuery) && !hasExactMatch;

  const addItem = (option) => {
    setQuery("");
    setIsOpen(false);
    onChange([...value, option]);
  };

  const handleKeyDown = (event) => {
    if (event.key !== "Enter") {
      return;
    }

    // The field sits inside the prescription form; Enter must add, not submit.
    event.preventDefault();

    if (filteredOptions.length === 1) {
      addItem(filteredOptions[0]);
    } else if (canAddCustom) {
      addItem(createOption(trimmedQuery));
    }
  };

  const handleRemove = (item) => {
    const removedKey = keyOf(item);
    onChange(value.filter((entry) => keyOf(entry) !== removedKey));
  };

  return (
    <div className="multi-select-picker">
      <div className="searchable-select">
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => !disabled && setIsOpen(true)}
          onBlur={() => window.setTimeout(() => setIsOpen(false), 140)}
          placeholder={placeholder}
          autoComplete="off"
          disabled={disabled}
        />
        {isOpen && !disabled ? (
          <div className="searchable-select-menu">
            {filteredOptions.map((option) => {
              const meta = getOptionMeta(option);
              return (
                <button
                  key={keyOf(option)}
                  className="searchable-select-option"
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => addItem(option)}
                >
                  <strong>{getOptionLabel(option)}</strong>
                  {meta ? <span>{meta}</span> : null}
                </button>
              );
            })}
            {canAddCustom ? (
              <button
                className="searchable-select-option multi-select-create"
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => addItem(createOption(trimmedQuery))}
              >
                <strong>Add &ldquo;{trimmedQuery}&rdquo;</strong>
                <span>Not in the list &mdash; will be saved for future use</span>
              </button>
            ) : null}
            {!filteredOptions.length && !canAddCustom ? (
              <div className="searchable-select-empty">{emptyLabel}</div>
            ) : null}
          </div>
        ) : null}
      </div>
      {value.length ? (
        <ul className="multi-select-chips">
          {value.map((item) => (
            <li key={keyOf(item)} className={`multi-select-chip${getOptionValue(item) ? "" : " is-new"}`}>
              <span>{getOptionLabel(item)}</span>
              <button
                type="button"
                onClick={() => handleRemove(item)}
                disabled={disabled}
                aria-label={`Remove ${getOptionLabel(item)}`}
                title="Remove"
              >
                &times;
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="multi-select-empty">{emptySelectionLabel}</p>
      )}
    </div>
  );
}
