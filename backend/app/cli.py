"""Verwaltung auf der Kommandozeile, z. B. im Container:

    docker compose exec app python -m app.cli users
    docker compose exec -it app python -m app.cli reset-password mama@example.org

Für den Fall, dass niemand mehr ins Konto kommt (es gibt bewusst keinen Versand von E-Mails).
"""

import argparse
import getpass
import sys

from sqlalchemy import select

from app.db import SessionLocal
from app.models import User
from app.schemas import PASSWORD_MIN_LENGTH
from app.security import hash_secret


def list_users() -> int:
    with SessionLocal() as db:
        users = list(db.scalars(select(User).order_by(User.id)))
    if not users:
        print("Noch kein Konto angelegt (Einrichtung im Browser öffnen).")
    for user in users:
        print(f"{user.email}  ({user.role})")
    return 0


def read_password(from_stdin: bool) -> str | None:
    if from_stdin:
        return sys.stdin.readline().rstrip("\n")
    first = getpass.getpass("Neues Passwort: ")
    if getpass.getpass("Passwort wiederholen: ") != first:
        print("Die Passwörter stimmen nicht überein.", file=sys.stderr)
        return None
    return first


def reset_password(email: str, from_stdin: bool) -> int:
    email = email.strip().lower()
    with SessionLocal() as db:
        user = db.scalars(select(User).where(User.email == email)).one_or_none()
        if user is None:
            print(f"Kein Konto mit der E-Mail-Adresse {email}. Vorhandene Konten:", file=sys.stderr)
            for other in db.scalars(select(User.email).order_by(User.id)):
                print(f"  {other}", file=sys.stderr)
            return 1
        password = read_password(from_stdin)
        if password is None:
            return 1
        if len(password) < PASSWORD_MIN_LENGTH:
            print(
                f"Das Passwort braucht mindestens {PASSWORD_MIN_LENGTH} Zeichen.", file=sys.stderr
            )
            return 1
        user.password_hash = hash_secret(password)
        db.commit()
    print(f"Das Passwort für {email} ist geändert. Die Anmeldung geht jetzt damit.")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m app.cli", description="FamQuest-Verwaltung")
    commands = parser.add_subparsers(dest="command", required=True)
    commands.add_parser("users", help="Konten auflisten")
    reset = commands.add_parser("reset-password", help="Passwort eines Kontos neu setzen")
    reset.add_argument("email")
    reset.add_argument(
        "--password-stdin",
        action="store_true",
        help="Passwort aus der Standardeingabe lesen statt nachzufragen",
    )
    args = parser.parse_args(argv)
    if args.command == "users":
        return list_users()
    return reset_password(args.email, args.password_stdin)


if __name__ == "__main__":
    sys.exit(main())
