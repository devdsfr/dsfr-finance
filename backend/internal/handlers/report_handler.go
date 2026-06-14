package handlers

import (
	"encoding/csv"
	"fmt"
	"net/http"

	"github.com/dsfr/finance/internal/middleware"
	"github.com/dsfr/finance/internal/repositories"
	"github.com/gin-gonic/gin"
	"github.com/xuri/excelize/v2"
)

type ReportHandler struct {
	repo *repositories.ReportRepository
}

func NewReportHandler(repo *repositories.ReportRepository) *ReportHandler {
	return &ReportHandler{repo}
}

// MonthlyFlow — income vs expense per month
func (h *ReportHandler) MonthlyFlow(c *gin.Context) {
	wsID := middleware.GetWorkspaceID(c)
	// Support ?month=YYYY-MM as shorthand for a single month
	if month := c.Query("month"); month != "" {
		year, mo := month[:4], month[5:7]
		from := fmt.Sprintf("%s-%s-01", year, mo)
		to := fmt.Sprintf("%s-%s-31", year, mo)
		data, err := h.repo.MonthlyFlow(wsID, from, to)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		// Return single-month summary object for dashboard
		if len(data) > 0 {
			row := data[0]
			c.JSON(http.StatusOK, gin.H{"data": gin.H{
				"month": row.Month, "income": row.Income,
				"expense": row.Expense, "net": row.Net,
			}})
		} else {
			c.JSON(http.StatusOK, gin.H{"data": gin.H{"month": month, "income": 0.0, "expense": 0.0, "net": 0.0}})
		}
		return
	}
	from := c.DefaultQuery("from", "2024-01-01")
	to := c.DefaultQuery("to", "2024-12-31")
	data, err := h.repo.MonthlyFlow(wsID, from, to)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": data})
}

// PatrimonyEvolution — AC-RL-22
func (h *ReportHandler) PatrimonyEvolution(c *gin.Context) {
	wsID := middleware.GetWorkspaceID(c)
	from := c.DefaultQuery("from", "2024-01-01")
	to := c.DefaultQuery("to", "2024-12-31")
	data, err := h.repo.PatrimonyEvolution(wsID, from, to)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": data})
}

// AccountBalanceHistory — AC-RL-18, AC-RL-19
func (h *ReportHandler) AccountBalanceHistory(c *gin.Context) {
	wsID := middleware.GetWorkspaceID(c)
	from := c.DefaultQuery("from", "2024-01-01")
	to := c.DefaultQuery("to", "2024-12-31")
	accountIDs := c.QueryArray("account_id")
	data, err := h.repo.AccountBalanceHistory(wsID, accountIDs, from, to)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": data})
}

// CategorySummary — returns totals per category
func (h *ReportHandler) CategorySummary(c *gin.Context) {
	wsID := middleware.GetWorkspaceID(c)
	from := c.DefaultQuery("from", "2024-01-01")
	to := c.DefaultQuery("to", "2024-12-31")
	txType := c.DefaultQuery("type", "expense")
	data, err := h.repo.CategorySummary(wsID, txType, from, to)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": data})
}

// TagsCTA — AC-RL-20: informs frontend whether to show the tags CTA
func (h *ReportHandler) TagsCTA(c *gin.Context) {
	wsID := middleware.GetWorkspaceID(c)
	from := c.DefaultQuery("from", "2024-01-01")
	to := c.DefaultQuery("to", "2024-12-31")
	hasTagged, err := h.repo.HasTaggedTransactions(wsID, from, to)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"show_cta": !hasTagged,
		"message":  "Você ainda não usou tags neste período. Tags ajudam a filtrar e analisar seus gastos com mais precisão!",
	})
}

// ActiveInstallments — AC-FC-09
func (h *ReportHandler) ActiveInstallments(c *gin.Context) {
	wsID := middleware.GetWorkspaceID(c)
	data, err := h.repo.ActiveInstallments(wsID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": data})
}

// CardInvoiceHistory — AC-FC-08
func (h *ReportHandler) CardInvoiceHistory(c *gin.Context) {
	wsID := middleware.GetWorkspaceID(c)
	cardID := c.Param("card_id")
	data, err := h.repo.CardInvoiceHistory(wsID, cardID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"data": data})
}

// ExportCSV — AC-RL-21: export monthly flow as CSV
func (h *ReportHandler) ExportCSV(c *gin.Context) {
	wsID := middleware.GetWorkspaceID(c)
	from := c.DefaultQuery("from", "2024-01-01")
	to := c.DefaultQuery("to", "2024-12-31")
	reportType := c.DefaultQuery("report", "flow")

	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%s.csv", reportType))
	c.Header("Content-Type", "text/csv; charset=utf-8")

	w := csv.NewWriter(c.Writer)
	defer w.Flush()

	switch reportType {
	case "flow":
		data, _ := h.repo.MonthlyFlow(wsID, from, to)
		_ = w.Write([]string{"Mês", "Receita", "Despesa", "Saldo"})
		for _, row := range data {
			_ = w.Write([]string{row.Month,
				fmt.Sprintf("%.2f", row.Income),
				fmt.Sprintf("%.2f", row.Expense),
				fmt.Sprintf("%.2f", row.Net),
			})
		}
	case "patrimony":
		data, _ := h.repo.PatrimonyEvolution(wsID, from, to)
		_ = w.Write([]string{"Mês", "Patrimônio Líquido"})
		for _, row := range data {
			_ = w.Write([]string{row.Month, fmt.Sprintf("%.2f", row.NetWorth)})
		}
	case "categories":
		txType := c.DefaultQuery("type", "expense")
		data, _ := h.repo.CategorySummary(wsID, txType, from, to)
		_ = w.Write([]string{"Categoria", "Total", "Qtd."})
		for _, row := range data {
			_ = w.Write([]string{row.CategoryName, fmt.Sprintf("%.2f", row.Total), fmt.Sprintf("%d", row.Count)})
		}
	case "installments":
		data, _ := h.repo.ActiveInstallments(wsID)
		_ = w.Write([]string{"Descricao", "Cartao", "Parcela", "Valor/Parcela", "Total Restante"})
		for _, row := range data {
			_ = w.Write([]string{row.Description, row.CardName,
				fmt.Sprintf("%d/%d", row.InstallmentNum, row.InstallmentTotal),
				fmt.Sprintf("%.2f", row.AmountPerPart),
				fmt.Sprintf("%.2f", row.TotalRemaining)})
		}
	}
}

// ExportExcel — AC-RL-21: export as Excel
func (h *ReportHandler) ExportExcel(c *gin.Context) {
	wsID := middleware.GetWorkspaceID(c)
	from := c.DefaultQuery("from", "2024-01-01")
	to := c.DefaultQuery("to", "2024-12-31")
	reportType := c.DefaultQuery("report", "flow")

	f := excelize.NewFile()
	defer f.Close()

	sheet := "Relatório"
	_ = f.SetSheetName("Sheet1", sheet)

	switch reportType {
	case "flow":
		data, _ := h.repo.MonthlyFlow(wsID, from, to)
		headers := []interface{}{"Mês", "Receita", "Despesa", "Saldo"}
		_ = f.SetSheetRow(sheet, "A1", &headers)
		for i, row := range data {
			r := []interface{}{row.Month, row.Income, row.Expense, row.Net}
			_ = f.SetSheetRow(sheet, fmt.Sprintf("A%d", i+2), &r)
		}
	case "patrimony":
		data, _ := h.repo.PatrimonyEvolution(wsID, from, to)
		headers := []interface{}{"Mês", "Patrimônio Líquido"}
		_ = f.SetSheetRow(sheet, "A1", &headers)
		for i, row := range data {
			r := []interface{}{row.Month, row.NetWorth}
			_ = f.SetSheetRow(sheet, fmt.Sprintf("A%d", i+2), &r)
		}
	case "categories":
		txType := c.DefaultQuery("type", "expense")
		data, _ := h.repo.CategorySummary(wsID, txType, from, to)
		headers := []interface{}{"Categoria", "Total", "Qtd."}
		_ = f.SetSheetRow(sheet, "A1", &headers)
		for i, row := range data {
			r := []interface{}{row.CategoryName, row.Total, row.Count}
			_ = f.SetSheetRow(sheet, fmt.Sprintf("A%d", i+2), &r)
		}
	}

	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%s.xlsx", reportType))
	c.Header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	_ = f.Write(c.Writer)
}
