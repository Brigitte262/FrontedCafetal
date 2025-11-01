// src/app/rrhh/Nomina.tsx
import * as React from "react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  Card, CardHeader, CardTitle, CardDescription, CardContent
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select, SelectTrigger, SelectContent, SelectItem, SelectValue
} from "@/components/ui/select";
import { DataTable } from "@/components/data-table";
import { formatCurrency, formatDate } from "@/lib/utils";
import { usePayrollPeriods, usePayrollSummary, usePayslips, Payslip } from "@/hooks/useCafetalApi";
import { Wand2 } from "lucide-react";

// Modal (shadcn/ui)
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

/* ===================== helpers URL ===================== */
function readEnv(key: string): string | undefined {
  const fromVite =
    (typeof import.meta !== "undefined" && (import.meta as any).env && (import.meta as any).env[key]) || undefined;
  const fromNext =
    (typeof process !== "undefined" && (process.env as any) && (process.env as any)[key]) || undefined;
  return (fromVite ?? fromNext)?.toString();
}
function ensureAbsoluteBase(raw?: string): string {
  const input = (raw ?? "").trim();
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  let base = input;
  if (!base) base = origin ? `${origin}/api/v1/` : `http://127.0.0.1:8080/api/v1/`;
  else if (base.startsWith("/")) base = (origin || `http://127.0.0.1:8080`) + base;
  else if (!/^https?:\/\//i.test(base)) base = (origin || `http://127.0.0.1:8080`) + "/" + base.replace(/^\/+/, "");
  if (!base.endsWith("/")) base += "/";
  return base;
}
const API_BASE = ensureAbsoluteBase(readEnv("VITE_API_BASE") ?? readEnv("NEXT_PUBLIC_API_BASE"));
const apiURL = (p: string) => API_BASE + p.replace(/^\/+/, "");

async function downloadBlobAs(filename: string, blob: Blob) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);
}

/* ========================= página ====================== */
export default function NominaPage() {
  // Periodos
  const { data: periods = [], loading: loadingPeriods } = usePayrollPeriods(24);
  const [periodId, setPeriodId] = React.useState<number | undefined>(undefined);
  React.useEffect(() => {
    if (!loadingPeriods && periods.length && periodId === undefined) setPeriodId(periods[0].id);
  }, [loadingPeriods, periods, periodId]);

  // KPIs + tabla
  const { data: resumen } = usePayrollSummary(periodId);
  const [q, setQ] = React.useState("");
  const [page, setPage] = React.useState(1);
  const pageSize = 10;
  const { data: slips = { items: [], total: 0 }, loading: loadingSlips, refetch: refetchSlips } = usePayslips({
    periodId, q, page, page_size: pageSize,
  });
  const totalPages = Math.max(1, Math.ceil((slips.total || 0) / pageSize));

  /* ======= Modal de generación ======= */
  const [open, setOpen] = React.useState(false);
  const [current, setCurrent] = React.useState<Payslip | null>(null);

  // Campos editables (precargados con la fila)
  const [base, setBase] = React.useState<number>(0);
  const [overtime, setOvertime] = React.useState<number>(0);
  const [bonus, setBonus] = React.useState<number>(0);
  const [deductions, setDeductions] = React.useState<number>(0);
  const [issueDate, setIssueDate] = React.useState<string>(""); // yyyy-mm-dd

  const [generating, setGenerating] = React.useState(false);

  function openGenerateModal(row: Payslip) {
    setCurrent(row);
    setBase(Number(row.base_salary ?? 0));
    setOvertime(Number(row.overtime ?? 0));
    setBonus(Number(row.bonus ?? 0));
    setDeductions(Number(row.deductions ?? 0));
    setIssueDate(new Date().toISOString().slice(0,10));
    setOpen(true);
  }

  async function handleGenerate() {
    if (!current || !periodId) return;
    try {
      setGenerating(true);

      const url = new URL(apiURL("rrhh/nomina/boleta_pdf"));
      url.searchParams.set("emp_id", String(current.emp_id));
      url.searchParams.set("period_id", String(periodId));
      url.searchParams.set("base", String(base));
      url.searchParams.set("overtime", String(overtime));
      url.searchParams.set("bonus", String(bonus));
      url.searchParams.set("deductions", String(deductions));
      url.searchParams.set("issue_date", issueDate);

      const res = await fetch(url.toString(), { method: "GET", credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const blob = await res.blob();
      const code = periods.find(p => p.id === periodId)?.code ?? "periodo";
      await downloadBlobAs(`Boleta_${current.emp_id}_${code}.pdf`.replace(/\s+/g, "_"), blob);

      setOpen(false);
      setCurrent(null);
      // Si luego marcas "generado" en el back, puedes refetchear:
      // refetchSlips?.();
    } catch (e) {
      console.error(e);
      alert("No se pudo generar la boleta.");
    } finally {
      setGenerating(false);
    }
  }

  // Columnas (incluye SIEMPRE el botón "Generar boleta")
const columns = React.useMemo<ColumnDef<Payslip>[]>(
  () => [
    { accessorKey: "empleado", header: "Empleado" },
    {
      accessorKey: "doc_id",
      header: "Documento",
      cell: ({ row }) => row.original.doc_id ?? "—",
    },
    {
      accessorKey: "base_salary",
      header: "Base",
      cell: ({ row }) => formatCurrency(row.original.base_salary ?? 0, "PEN"),
    },
    {
      accessorKey: "overtime",
      header: "Horas extra",
      cell: ({ row }) => formatCurrency(row.original.overtime ?? 0, "PEN"),
    },
    {
      accessorKey: "bonus",
      header: "Bonos",
      cell: ({ row }) => formatCurrency(row.original.bonus ?? 0, "PEN"),
    },
    {
      accessorKey: "deductions",
      header: "Deducciones",
      cell: ({ row }) => formatCurrency(row.original.deductions ?? 0, "PEN"),
    },
    {
      accessorKey: "net",
      header: "Neto",
      cell: ({ row }) => (
        <span className="font-medium">
          {formatCurrency(row.original.net ?? 0, "PEN")}
        </span>
      ),
    },

    {
      accessorKey: "emp_id",
      header: "Acciones",
      enableSorting: false,
      enableHiding: false,
      size: 170,
      cell: ({ row }) => (
        <div className="flex justify-start min-w-[170px]">
  <Button
    size="sm"
    title="Generar boleta"
    onClick={() => openGenerateModal(row.original)}
    className="gap-2 !bg-[#7a1e3a] hover:!bg-[#5e1428] !text-white rounded-md shadow-sm
               focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e4a4b6]
               focus-visible:ring-offset-2"
  >
    <Wand2 className="h-4 w-4" />
    Generar boleta
  </Button>
</div>

      ),
    },
  ],
  [openGenerateModal]
);



  return (
    <div className="space-y-6">
      {/* Header / filtros */}
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-semibold">Gestión de Remuneraciones</h1>
        <div className="ml-auto flex items-center gap-2">
          <Select
            value={periodId === undefined ? "" : String(periodId)}
            onValueChange={(value: string) => {
              setPeriodId(Number(value));
              setPage(1);
            }}
          >
            <SelectTrigger className="w-[260px]">
              <SelectValue placeholder="Periodo" />
            </SelectTrigger>
            <SelectContent>
              {periods.map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>
                  {formatDate(p.start)} – {formatDate(p.end)} ({p.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => refetchSlips?.()}>
            Refrescar
          </Button>
        </div>
      </div>

      {/* KPIs simples */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPI title="Empleados" value={resumen?.empleados ?? 0} />
        <KPI title="Bruto" value={formatCurrency(resumen?.bruto ?? 0, "PEN")} />
        <KPI
          title="Deducciones"
          value={formatCurrency(resumen?.deducciones ?? 0, "PEN")}
        />
        <KPI title="Neto" value={formatCurrency(resumen?.neto ?? 0, "PEN")} />
      </div>

      {/* Tabla única */}
      <Card className="rounded-2xl bg-white dark:bg-neutral-900 ring-1 ring-black/5 dark:ring-white/10">
        <CardHeader>
          <CardTitle>Boletas</CardTitle>
          <CardDescription>
            Genera la boleta de cualquier empleado.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-3 flex items-center gap-2">
            <input
              className="h-9 w-full max-w-sm rounded-md border bg-background px-3 text-sm outline-none
                         ring-offset-background placeholder:text-muted-foreground
                         focus-visible:ring-2 focus-visible:ring-ring"
              placeholder="Buscar empleado, documento, email…"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
            />
            <div className="ml-auto flex items-center gap-2 text-sm">
              <Button
                variant="outline"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1 || loadingSlips}
              >
                Anterior
              </Button>
              <span className="text-muted-foreground">
                Página {page} / {totalPages}
              </span>
              <Button
                variant="outline"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages || loadingSlips}
              >
                Siguiente
              </Button>
            </div>
          </div>

          {loadingSlips ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : (
            <DataTable
              className="[&_.dt-toolbar]:hidden"
              columns={columns}
              data={slips.items}
              enableSelection={false}
            />
          )}
        </CardContent>
      </Card>

      {/* Modal de generación */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Generar boleta</DialogTitle>
            <DialogDescription>
              {current
                ? `${current.empleado} · Doc: ${current.doc_id ?? "—"}`
                : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Base</Label>
              <Input
                type="number"
                step="0.01"
                value={base}
                onChange={(e) => setBase(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1">
              <Label>Horas extra</Label>
              <Input
                type="number"
                step="0.01"
                value={overtime}
                onChange={(e) => setOvertime(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1">
              <Label>Bonos</Label>
              <Input
                type="number"
                step="0.01"
                value={bonus}
                onChange={(e) => setBonus(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1">
              <Label>Deducciones</Label>
              <Input
                type="number"
                step="0.01"
                value={deductions}
                onChange={(e) => setDeductions(Number(e.target.value))}
              />
            </div>
            <div className="col-span-2 space-y-1">
              <Label>Fecha de emisión</Label>
              <Input
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              className="border-[#7a1e3a] text-[#7a1e3a] hover:bg-[#fbe9ef]"
            >
              Cancelar
            </Button>

            <Button
              onClick={handleGenerate}
              disabled={generating}
              className="gap-2 !bg-[#7a1e3a] hover:!bg-[#5e1428] !text-white rounded-md shadow-sm
               focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e4a4b6]
               focus-visible:ring-offset-2 disabled:opacity-60 disabled:pointer-events-none"
            >
              {generating ? "Generando…" : "Generar y descargar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ——— KPI simple ——— */
function KPI({ title, value }: { title: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl border bg-gradient-to-br from-amber-50 to-amber-100/40 p-4 dark:from-amber-950/50 dark:to-amber-900/20">
      <div className="text-xs text-muted-foreground">{title}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}







