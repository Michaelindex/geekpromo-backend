#!/bin/bash

# ============================================================================
# Script de Execução da Migração de Timezone
# ============================================================================

set -e

DB_HOST="72.60.10.64"
DB_USER="root"
DB_PASS="Pa\$\$w0rd"
DB_NAME="geekloko_db"

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo "============================================================================"
echo "  MIGRAÇÃO DE TIMEZONE - GMT-3 (Brasília)"
echo "============================================================================"
echo ""

# Função para executar SQL
execute_sql() {
  mysql -h"$DB_HOST" -u"$DB_USER" -p"$DB_PASS" "$DB_NAME" -e "$1" 2>&1 | grep -v "Warning"
}

# Função para executar arquivo SQL
execute_sql_file() {
  mysql -h"$DB_HOST" -u"$DB_USER" -p"$DB_PASS" "$DB_NAME" < "$1" 2>&1 | grep -v "Warning"
}

echo "📊 PASSO 1: Validação PRÉ-MIGRAÇÃO"
echo "-----------------------------------"
echo ""

if [ -f "$SCRIPT_DIR/validate_before_migration.sql" ]; then
  execute_sql_file "$SCRIPT_DIR/validate_before_migration.sql"
else
  echo "❌ Arquivo validate_before_migration.sql não encontrado!"
  exit 1
fi

echo ""
echo "============================================================================"
echo "⚠️  ATENÇÃO: Revise os resultados acima"
echo "============================================================================"
echo ""
echo "A migração irá:"
echo "  1. Deletar registros duplicados"
echo "  2. Mover registros únicos para o dia anterior"
echo ""
read -p "Deseja continuar? (sim/não): " resposta

if [ "$resposta" != "sim" ]; then
  echo "❌ Migração cancelada pelo usuário"
  exit 0
fi

echo ""
echo "🚀 PASSO 2: Executando MIGRAÇÃO"
echo "-----------------------------------"
echo ""

# Executar migração
if [ -f "$SCRIPT_DIR/fix_timezone_daily_visits.sql" ]; then
  # Criar uma sessão interativa para permitir commit/rollback manual
  echo "⚠️  A migração será executada em modo TRANSACIONAL"
  echo "⚠️  Você precisará revisar e digitar COMMIT; para confirmar"
  echo ""
  echo "Pressione ENTER para continuar..."
  read
  
  mysql -h"$DB_HOST" -u"$DB_USER" -p"$DB_PASS" "$DB_NAME" < "$SCRIPT_DIR/fix_timezone_daily_visits.sql"
  
  echo ""
  echo "============================================================================"
  echo "⚠️  IMPORTANTE: A transação está ABERTA"
  echo "============================================================================"
  echo ""
  echo "Para CONFIRMAR a migração, execute:"
  echo "  mysql -h72.60.10.64 -uroot -p'Pa\$\$w0rd' geekloko_db -e 'COMMIT;'"
  echo ""
  echo "Para REVERTER a migração, execute:"
  echo "  mysql -h72.60.10.64 -uroot -p'Pa\$\$w0rd' geekloko_db -e 'ROLLBACK;'"
  echo ""
else
  echo "❌ Arquivo fix_timezone_daily_visits.sql não encontrado!"
  exit 1
fi

echo ""
echo "✅ Script de migração executado!"
echo ""

