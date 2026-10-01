"""Haushalt statt Erwachsenen-Aufgaben

Aufgaben gibt es nur noch für Kinder; die Hausarbeit der Erwachsenen steht im Putzplan. Aufgaben,
die ausschließlich Erwachsenen zugeordnet sind, werden mit Wiederholung, Zuordnungen und
Erledigungen gelöscht; bei gemischten Aufgaben fällt nur die Zuordnung der Erwachsenen weg.
Punktebuchungen bleiben stehen (ihr Verweis auf die Aufgabe wird leer).

Das lässt sich nicht zurücknehmen: Ein Downgrade stellt die gelöschten Aufgaben nicht wieder her.

Revision ID: c3a9e51d7b42
Revises: 8fc58f53970c
Create Date: 2026-10-01 18:20:00.000000
"""

from collections.abc import Sequence

from alembic import op

revision: str = "c3a9e51d7b42"
down_revision: str | Sequence[str] | None = "8fc58f53970c"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Aufgaben ohne jede Zuordnung (z. B. nach dem Löschen einer Person) bleiben unberührt.
    op.execute(
        """
        DELETE FROM tasks WHERE id IN (
            SELECT a.task_id
            FROM task_assignments a JOIN family_members m ON m.id = a.member_id
            GROUP BY a.task_id
            HAVING bool_and(m.role <> 'child')
        )
        """
    )
    op.execute(
        """
        DELETE FROM task_assignments a USING family_members m
        WHERE m.id = a.member_id AND m.role <> 'child'
        """
    )
    op.execute(
        """
        DELETE FROM routines r USING family_members m
        WHERE m.id = r.member_id AND m.role <> 'child'
        """
    )


def downgrade() -> None:
    pass
