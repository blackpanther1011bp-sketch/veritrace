import { GRADE_COLOR, GRADES } from "../lib/grades";
import { t } from "../lib/i18n";
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
        // 13 px minimum, même dans les petites pastilles
        fontSize: Math.max(13, Math.round(size * 0.46)),
      }}
      aria-label={grade ? t("common.noteGrade", { grade }) : t("common.noGrade")}
    >
      {grade ?? "?"}
    </span>
  );
}

export function GradeScale({ grade }: { grade: Grade | null }) {
  return (
    <div className="grade-scale" role="img" aria-label={grade ? t("common.gradeScale", { grade }) : t("common.gradeScaleNone")}>
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
