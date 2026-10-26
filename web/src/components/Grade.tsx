import { GRADE_COLOR, GRADES } from "../lib/grades";
import type { Grade } from "../lib/types";

export function GradeBadge({ grade, size = 44, round = false }: { grade: Grade | null; size?: number; round?: boolean }) {
  return (
    <span
      className="grade-badge"
      style={{
        width: size,
        height: size,
        borderRadius: round ? "50%" : Math.round(size * 0.28),
        background: grade ? GRADE_COLOR[grade] : "#DDE3DE",
        fontSize: Math.round(size * 0.46),
      }}
      aria-label={grade ? `Note ${grade}` : "Pas de note"}
    >
      {grade ?? "?"}
    </span>
  );
}

export function GradeScale({ grade }: { grade: Grade }) {
  return (
    <div className="grade-scale" role="img" aria-label={`Note ${grade} sur une échelle de A à E`}>
      {GRADES.map((g) => (
        <span
          key={g}
          style={{
            background: GRADE_COLOR[g],
            opacity: g === grade ? 1 : 0.3,
            height: g === grade ? 12 : 8,
          }}
        />
      ))}
    </div>
  );
}
