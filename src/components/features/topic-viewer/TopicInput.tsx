'use client';

import { useEffect, useId, useState } from 'react';
import type { ChangeEvent, KeyboardEvent } from 'react';
import type { TopicInfo } from '@/lib/bridge/types';
import { normalizeMessageType, topicNameError, topicTypeMismatch } from '@/lib/bridge/topics';

interface TopicInputProps {
  value: string;
  onCommit: (topic: string) => void;
  topics?: TopicInfo[];
  /** Message type(s) the consumer can display; filters suggestions and flags mismatches. */
  messageType?: string | string[];
  placeholder?: string;
  className?: string;
  'aria-label'?: string;
}

/**
 * A topic field that only reports complete names. Subscribing on every keystroke made the bridge
 * subscribe to `/l`, `/li`, … and reject partial names such as `/livox/`.
 */
export default function TopicInput({
  value,
  onCommit,
  topics = [],
  messageType,
  placeholder = '/topic',
  className,
  'aria-label': ariaLabel,
}: TopicInputProps) {
  const listId = useId();
  const [draft, setDraft] = useState(value);
  const [nameError, setNameError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(value);
    setNameError(null);
  }, [value]);

  const accepted = messageType
    ? (Array.isArray(messageType) ? messageType : [messageType]).map(normalizeMessageType)
    : null;
  const suggestions = accepted
    ? topics.filter((t) => accepted.includes(normalizeMessageType(t.type)))
    : topics;
  const mismatch = messageType && value ? topicTypeMismatch(topics, value, messageType) : null;

  const commit = (next: string) => {
    const topic = next.trim();
    const error = topicNameError(topic);
    setNameError(error);
    if (!error && topic !== value) onCommit(topic);
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const next = e.target.value;
    setDraft(next);
    setNameError(null);
    // Choosing a datalist option is a complete name; typed characters are not.
    const inputType = (e.nativeEvent as InputEvent).inputType;
    const picked =
      inputType === 'insertReplacementText' ||
      (inputType === undefined && suggestions.some((t) => t.topic === next));
    if (picked) commit(next);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commit(draft);
    } else if (e.key === 'Escape') {
      e.stopPropagation();
      setDraft(value);
      setNameError(null);
    }
  };

  return (
    <>
      <input
        aria-label={ariaLabel}
        aria-invalid={nameError ? true : undefined}
        className={className}
        list={listId}
        value={draft}
        onChange={handleChange}
        onBlur={() => commit(draft)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        spellCheck={false}
        autoComplete="off"
      />
      <datalist id={listId}>
        {suggestions.map((t) => (
          <option key={t.topic} value={t.topic} />
        ))}
      </datalist>
      {nameError && <p className="topic-input-hint text-danger">{nameError}</p>}
      {!nameError && mismatch && (
        <p className="topic-input-hint text-warn">
          {value} publishes {mismatch}, not {(accepted ?? []).join(' or ')}
        </p>
      )}
    </>
  );
}
