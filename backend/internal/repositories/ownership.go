package repositories

import "database/sql"

// Verificação de propriedade de referência por workspace (AUD-001).
//
// Estas funções são o ponto único de verdade do invariante:
//
//	nenhum dado do workspace A pode referenciar recurso do workspace B.
//
// Ficam como funções livres — e não como métodos de um repositório — porque
// precisam ser chamadas de lugares que não têm o TransactionRepository:
// a importação de extrato, os limites de gastos e os objetivos.
//
// Duplicar o `SELECT EXISTS` em cada handler funcionaria, mas checagem de
// segurança duplicada é exatamente o que diverge com o tempo: bastaria um
// deles esquecer o filtro numa alteração futura.
//
// Convenção: id vazio devolve (false, nil). Quem chama decide se campo
// ausente é erro — em geral não é, porque a FK é opcional.

func belongsToWorkspace(db *sql.DB, query, workspaceID, id string) (bool, error) {
	if id == "" {
		return false, nil
	}
	var ok bool
	err := db.QueryRow(query, id, workspaceID).Scan(&ok)
	return ok, err
}

// AccountBelongsTo informa se a conta pertence ao workspace.
func AccountBelongsTo(db *sql.DB, workspaceID, id string) (bool, error) {
	return belongsToWorkspace(db,
		`SELECT EXISTS(SELECT 1 FROM accounts WHERE id=$1 AND workspace_id=$2)`,
		workspaceID, id)
}

// CreditCardBelongsTo informa se o cartão pertence ao workspace.
func CreditCardBelongsTo(db *sql.DB, workspaceID, id string) (bool, error) {
	return belongsToWorkspace(db,
		`SELECT EXISTS(SELECT 1 FROM credit_cards WHERE id=$1 AND workspace_id=$2)`,
		workspaceID, id)
}

// CategoryBelongsTo informa se a categoria pertence ao workspace.
func CategoryBelongsTo(db *sql.DB, workspaceID, id string) (bool, error) {
	return belongsToWorkspace(db,
		`SELECT EXISTS(SELECT 1 FROM categories WHERE id=$1 AND workspace_id=$2)`,
		workspaceID, id)
}

// TagBelongsTo informa se a tag pertence ao workspace.
func TagBelongsTo(db *sql.DB, workspaceID, id string) (bool, error) {
	return belongsToWorkspace(db,
		`SELECT EXISTS(SELECT 1 FROM tags WHERE id=$1 AND workspace_id=$2)`,
		workspaceID, id)
}

// OptionalRefBelongsTo aplica a regra dos campos opcionais: ponteiro nulo ou
// string vazia passa; qualquer valor preenchido precisa pertencer ao
// workspace. Usada pelos handlers cujos modelos têm FK como *string.
func OptionalRefBelongsTo(
	db *sql.DB,
	workspaceID string,
	id *string,
	check func(*sql.DB, string, string) (bool, error),
) (bool, error) {
	if id == nil || *id == "" {
		return true, nil
	}
	return check(db, workspaceID, *id)
}
