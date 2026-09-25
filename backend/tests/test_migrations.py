from alembic import command

from tests.conftest import alembic_config


def test_migrations_upgrade_and_downgrade():
    config = alembic_config()
    command.downgrade(config, "base")
    command.upgrade(config, "head")


def test_models_match_migrations():
    # Schlägt fehl, wenn Modelle geändert wurden, ohne eine Migration anzulegen.
    command.check(alembic_config())
