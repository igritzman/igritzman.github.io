import { useEffect, useMemo, useState } from "react";
import type { TransitTimeMachineEntry } from "../data/transitTimeMachineImages";

export function TransitTimeMachinePanel({ entry }: { entry: TransitTimeMachineEntry }) {
  const [activeEra, setActiveEra] = useState(0);
  const [playing, setPlaying] = useState(false);
  const era = entry.eras[activeEra];
  const availableCount = useMemo(() => entry.eras.filter((item) => item.imageUrl).length, [entry]);

  useEffect(() => {
    setActiveEra(0);
    setPlaying(false);
  }, [entry.city]);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => {
      setActiveEra((current) => {
        if (current >= entry.eras.length - 1) {
          setPlaying(false);
          return current;
        }
        return current + 1;
      });
    }, 1600);
    return () => window.clearInterval(timer);
  }, [playing, entry.eras.length]);

  return (
    <section className="time-machine-panel" aria-label={`${entry.city} Transit Time Machine`}>
      <header className="time-machine-heading">
        <div>
          <span className="eyebrow">Transit Time Machine</span>
          <h3>{entry.city}</h3>
          <p>{entry.system} · {entry.country}</p>
        </div>
        <span className="time-machine-coverage">{availableCount}/3 maps</span>
      </header>

      <div className="time-machine-player">
        <div className="time-machine-year-row">
          <strong>{era.year}</strong>
          <span>{era.label}</span>
        </div>
        <input
          aria-label={`Choose ${entry.city} transit era`}
          type="range"
          min="0"
          max={entry.eras.length - 1}
          step="1"
          value={activeEra}
          onChange={(event) => {
            setPlaying(false);
            setActiveEra(Number(event.target.value));
          }}
        />
        <div className="time-machine-ticks" aria-hidden="true">
          {entry.eras.map((item) => <span key={item.key}>{item.year}</span>)}
        </div>
        <button type="button" className="secondary-button" onClick={() => {
          if (activeEra === entry.eras.length - 1) setActiveEra(0);
          setPlaying((value) => !value);
        }}>
          {playing ? "Pause evolution" : "▶ Play evolution"}
        </button>
      </div>

      <div className="time-machine-era-grid">
        {entry.eras.map((item, index) => (
          <article className={`time-machine-era-card ${index === activeEra ? "is-active" : ""}`} key={item.key}>
            <button type="button" className="time-machine-era-select" onClick={() => {
              setPlaying(false);
              setActiveEra(index);
            }} aria-pressed={index === activeEra}>
              <span>{item.label}</span>
              <strong>{item.year}</strong>
            </button>
            {item.imageUrl ? (
              <img src={item.imageUrl} alt={`${entry.city} ${item.label.toLowerCase()} transit map`} loading="lazy" />
            ) : (
              <div className="time-machine-missing">
                <span>Needs asset</span>
                <small>Search queries are ready for a reusable historical map.</small>
              </div>
            )}
            <p>{item.caption}</p>
            {item.imageUrl && item.sourceUrl.startsWith("http") ? (
              <a href={item.sourceUrl} target="_blank" rel="noreferrer">Source</a>
            ) : item.imageUrl ? (
              <small className="asset-provenance">Provided archive · license review pending</small>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
