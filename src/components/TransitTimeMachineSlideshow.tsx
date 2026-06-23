import { useEffect, useMemo, useState } from "react";
import type { TransitTimeMachineEntry } from "../data/transitTimeMachineImages";

export function TransitTimeMachineSlideshow({ entry }: { entry: TransitTimeMachineEntry }) {
  const [activeEra, setActiveEra] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const era = entry.eras[activeEra];
  const availableCount = useMemo(() => entry.eras.filter((item) => item.imageUrl).length, [entry]);

  const move = (direction: -1 | 1) => {
    setPlaying(false);
    setActiveEra((current) => (current + direction + entry.eras.length) % entry.eras.length);
  };

  useEffect(() => {
    setActiveEra(0);
    setPlaying(false);
    setLightboxOpen(false);
  }, [entry.city]);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setInterval(() => setActiveEra((current) => (current + 1) % entry.eras.length), 2200);
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

      <div className="time-machine-stage">
        <div className="time-machine-year-row"><strong>{era.year}</strong><span>{era.label}</span></div>
        <div
          className="time-machine-slide"
          onTouchStart={(event) => setTouchStart(event.touches[0]?.clientX ?? null)}
          onTouchEnd={(event) => {
            if (touchStart === null) return;
            const distance = (event.changedTouches[0]?.clientX ?? touchStart) - touchStart;
            if (Math.abs(distance) > 45) move(distance < 0 ? 1 : -1);
            setTouchStart(null);
          }}
        >
          <button type="button" className="time-machine-nav previous" onClick={() => move(-1)} aria-label="Previous transit era">‹</button>
          {era.imageUrl ? (
            <button type="button" className="time-machine-image-button" onClick={() => setLightboxOpen(true)} aria-label={`Enlarge ${entry.city} ${era.year} transit map`}>
              <img src={era.imageUrl} alt={`${entry.city} ${era.label.toLowerCase()} transit map`} />
              <span>Click to enlarge</span>
            </button>
          ) : (
            <div className="time-machine-missing"><span>Needs asset</span><small>Reusable-map search queries are ready in the asset dashboard.</small></div>
          )}
          <button type="button" className="time-machine-nav next" onClick={() => move(1)} aria-label="Next transit era">›</button>
        </div>
        <p className="time-machine-caption">{era.caption}</p>
        <div className="time-machine-controls">
          <button type="button" className="secondary-button" onClick={() => setPlaying((value) => !value)}>{playing ? "Pause evolution" : "▶ Play evolution"}</button>
          <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${entry.city} transit`)}`} target="_blank" rel="noreferrer">Explore city map</a>
        </div>
        <input aria-label={`Choose ${entry.city} transit era`} type="range" min="0" max={entry.eras.length - 1} step="1" value={activeEra} onChange={(event) => { setPlaying(false); setActiveEra(Number(event.target.value)); }} />
        <div className="time-machine-ticks" aria-hidden="true">{entry.eras.map((item) => <span key={item.key}>{item.year}</span>)}</div>
      </div>

      <div className="time-machine-thumbnail-row" aria-label="Choose an era">
        {entry.eras.map((item, index) => (
          <button type="button" key={item.key} className={index === activeEra ? "is-active" : ""} aria-pressed={index === activeEra} onClick={() => { setPlaying(false); setActiveEra(index); }}>
            {item.imageUrl ? <img src={item.imageUrl} alt="" loading="lazy" /> : <span>Map needed</span>}
            <strong>{item.year}</strong><small>{item.label}</small>
          </button>
        ))}
      </div>

      {lightboxOpen && era.imageUrl ? (
        <div className="time-machine-lightbox" role="dialog" aria-modal="true" aria-label={`${entry.city} ${era.year} map enlargement`}>
          <button type="button" className="time-machine-lightbox-close" onClick={() => setLightboxOpen(false)} aria-label="Close enlarged map">×</button>
          <img src={era.imageUrl} alt={`${entry.city} transit map in ${era.year}`} />
          <div><strong>{entry.city} · {era.year}</strong><span>{era.caption}</span></div>
        </div>
      ) : null}
    </section>
  );
}
