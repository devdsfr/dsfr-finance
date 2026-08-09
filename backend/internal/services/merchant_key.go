package services

import (
	"regexp"
	"strings"
)

// Normalização de descrição de lançamento, compartilhada entre o importador
// de extrato OFX e o agente do WhatsApp. O objetivo é reduzir
// "COMPRA CARTAO 1234 IFOOD *IFOOD SAO PAULO" a "IFOOD", para que lançamentos
// do mesmo estabelecimento caiam na mesma chave e herdem a categoria.

var nonAlpha = regexp.MustCompile(`[^A-Z ]+`)
var spacesRe = regexp.MustCompile(` +`)

// Palavras que aparecem em quase todo extrato e não identificam quem recebeu.
var noiseWords = map[string]bool{
	"COMPRA": true, "CARTAO": true, "CART": true, "DEBITO": true, "CREDITO": true,
	"PAGAMENTO": true, "PAGTO": true, "PAG": true, "PIX": true, "TED": true, "DOC": true,
	"TRANSFERENCIA": true, "TRANSF": true, "ENVIADO": true, "RECEBIDO": true,
	"SAQUE": true, "DEPOSITO": true, "TARIFA": true, "COMPRAS": true, "ELETRONICA": true,
	"PARCELA": true, "REF": true, "DE": true, "DA": true, "DO": true, "PARA": true,
	"LTDA": true, "ME": true, "SA": true, "EIRELI": true, "BR": true, "APP": true,
}

// Sem trocar acentuadas por ASCII, o regex quebraria "CARTÃO" em "CART" + "O".
var accentPairs = strings.NewReplacer(
	"Á", "A", "À", "A", "Ã", "A", "Â", "A", "Ä", "A",
	"É", "E", "Ê", "E", "È", "E", "Ë", "E",
	"Í", "I", "Î", "I", "Ì", "I", "Ï", "I",
	"Ó", "O", "Õ", "O", "Ô", "O", "Ò", "O", "Ö", "O",
	"Ú", "U", "Û", "U", "Ù", "U", "Ü", "U",
	"Ç", "C", "Ñ", "N",
)

// MerchantKey extrai a assinatura do estabelecimento de uma descrição.
// Retorna "" quando não sobra nada identificável.
func MerchantKey(desc string) string {
	s := accentPairs.Replace(strings.ToUpper(desc))
	s = nonAlpha.ReplaceAllString(s, " ")
	s = spacesRe.ReplaceAllString(s, " ")
	s = strings.TrimSpace(s)

	tokens := []string{}
	for _, t := range strings.Fields(s) {
		if len(t) < 3 || noiseWords[t] {
			continue
		}
		tokens = append(tokens, t)
		if len(tokens) == 2 { // duas palavras já identificam bem
			break
		}
	}
	if len(tokens) == 0 {
		return ""
	}
	return strings.Join(tokens, " ")
}
