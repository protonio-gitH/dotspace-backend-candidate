import { QueryInterface } from 'sequelize';

interface MigrationContext {
  context: QueryInterface;
}

export async function up({ context: queryInterface }: MigrationContext) {
  await queryInterface.addIndex('registrations', ['event_id', 'user_id'], {
    unique: true,
    name: 'registrations_event_id_user_id_unique',
  });
}

export async function down({ context: queryInterface }: MigrationContext) {
  await queryInterface.removeIndex(
    'registrations',
    'registrations_event_id_user_id_unique',
  );
}
