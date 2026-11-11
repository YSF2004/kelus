"use client";

import Link from "next/link";
import { deriveStatus } from "@/domain/learner-model";
import type { Concept, ConceptRelationship } from "@/domain/types";
import { percent, statusLabel } from "@/lib/format";

export function KnowledgeMap({ courseName, mastery, concepts, relationships = [], heading = "Knowledge map", selectedId, onSelect }: {
  courseName: string;
  mastery: number;
  concepts: Concept[];
  relationships?: ConceptRelationship[];
  heading?: string | null;
  selectedId?: string | null;
  onSelect?: (concept: Concept) => void;
}) {
  return (
    <section className="section" aria-labelledby={heading ? "map-heading" : undefined} aria-label={heading ? undefined : "Knowledge map"}>
      {heading ? <h2 id="map-heading">{heading}</h2> : null}
      <div className="map">
        <div className="map-head">
          <span>{courseName}</span>
          <strong>{percent(mastery)}</strong>
        </div>
        {relationships.length ? <div className="map-relationships" aria-label="Source-supported concept paths">
          <span>Prerequisite paths</span>
          <ul>{relationships.map((relationship) => {
            const from = concepts.find((concept) => concept.id === relationship.fromId);
            const to = concepts.find((concept) => concept.id === relationship.toId);
            if (!from || !to) return null;
            const isPrerequisite = relationship.kind === "prerequisite";
            return <li key={relationship.id}>
              {onSelect ? <button type="button" onClick={() => onSelect(from)}>{from.name}</button> : <strong>{from.name}</strong>}
              <i aria-hidden="true">{isPrerequisite ? "→" : "↔"}</i>
              {onSelect ? <button type="button" onClick={() => onSelect(to)}>{to.name}</button> : <strong>{to.name}</strong>}
              {relationship.evidence ? <small>{isPrerequisite ? "Prerequisite" : "Cross-reference"} · {relationship.evidence.label} · {relationship.evidence.locator}</small> : null}
            </li>;
          })}</ul>
        </div> : null}
        <ul className="map-list">
          {concepts.map((concept) => {
            const status = deriveStatus(concept.mastery, concept.predictedRetention, concept.retrievalAttempts);
            return (
              <li key={concept.id}>
                {onSelect ? <button type="button" className={`row${selectedId === concept.id ? " is-selected" : ""}`} aria-pressed={selectedId === concept.id} onClick={() => onSelect(concept)}>
                  <span>
                    {concept.name}
                    <span className="bar" aria-hidden="true"><i style={{ width: percent(concept.mastery) }} /></span>
                  </span>
                  <span className={`mark-status is-${status}`}>{statusLabel(status)}</span>
                  <span className="pct">{percent(concept.mastery)}</span>
                </button> : <Link href={`/concepts/${encodeURIComponent(concept.id)}`} className="row">
                  <span>
                    {concept.name}
                    <span className="bar" aria-hidden="true"><i style={{ width: percent(concept.mastery) }} /></span>
                  </span>
                  <span className={`mark-status is-${status}`}>{statusLabel(status)}</span>
                  <span className="pct">{percent(concept.mastery)}</span>
                </Link>}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
