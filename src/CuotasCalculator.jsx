import { useState, useEffect } from "react";
import { Copy, Check } from "lucide-react";

const CUOTA_DEFINITIONS = [
  { id: "cuota1", title: "CS1", varKey: "plan_cuota_simple_1", defaultPct: 10, installments: 1 },
  { id: "cuotaSimple3", title: "CUOTA SIMPLE 3", varKey: "plan_cuota_simple_3", defaultPct: 19, installments: 3 },
  { id: "cuotaSimple6", title: "CUOTA SIMPLE 6", varKey: "plan_cuota_simple_6", defaultPct: 29, installments: 6 },
  { id: "cuotaSimple9", title: "CUOTA SIMPLE 9", varKey: "plan_cuota_simple_9", defaultPct: 33, installments: 9 },
  { id: "cuotaSimple12", title: "CUOTA SIMPLE 12", varKey: "plan_cuota_simple_12", defaultPct: 45, installments: 12 },
];

const formatNumber = (num) => {
  if (num === null || num === undefined || isNaN(num)) return "-";
  // Usamos el formato de moneda para que agregue el símbolo y el espaciado correcto.
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS", // Usamos ARS para el formato, pero quitamos el identificador.
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: true,
  }).format(num).replace("ARS", "").trim(); // Quitamos 'ARS' para que no se duplique.
};

const buildTableText = (title, pct, rows, amountType) => {
  const amountLabel = amountType === 'primerPago' ? '1ER PAGO' : 'TOTAL';
  const header = `Cálculo para: ${amountLabel} ${title} (${pct}%)`;
  const body = rows
    .map(
      (row) =>
        `- ${row.label}: ${formatNumber(row.ars)} ARS / ${formatNumber(row.usd)} USD`,
    )
    .join("\n");
  return `${header}\n\n${body}`;
};

const buildTableHtml = (title, pct, rows, amountType) => {
  const amountLabel = amountType === 'primerPago' ? '1ER PAGO' : 'TOTAL';
  const headCells = `<th style="text-align:left;padding:4px 8px;background:#2563eb;color:#fff;">${amountLabel} ${title} (${pct}%)</th><th style="text-align:right;padding:4px 8px;background:#2563eb;color:#fff;">$ARG</th><th style="text-align:right;padding:4px 8px;background:#2563eb;color:#fff;">USD</th>`;
  const bodyRows = rows
    .map(
      (row) =>
        `<tr><td style="padding:4px 8px;">${row.label}</td><td style="text-align:right;padding:4px 8px;">${formatNumber(row.ars)}</td><td style="text-align:right;padding:4px 8px;">${formatNumber(row.usd)}</td></tr>`,
    )
    .join("");
  return `<table style="border-collapse:collapse;font-family:sans-serif;font-size:13px;"><thead><tr>${headCells}</tr></thead><tbody>${bodyRows}</tbody></table>`;
};

const copyToClipboard = async (text, html) => {
  if (navigator.clipboard && window.ClipboardItem) {
    try {
      await navigator.clipboard.write([
        new window.ClipboardItem({
          "text/plain": new Blob([text], { type: "text/plain" }),
          "text/html": new Blob([html], { type: "text/html" }),
        }),
      ]);
      return true;
    } catch (err) {
      // sigue con los fallbacks de abajo
    }
  }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      // sigue con el fallback de abajo
    }
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch (err) {
    ok = false;
  }
  document.body.removeChild(textarea);
  return ok;
};

const RateTable = ({ title, pct, montoNetoARS, montoNetoUSD, amountType, installments }) => {
  const [copied, setCopied] = useState(false);

  const recargoARS = montoNetoARS * (pct / 100);
  const recargoUSD = montoNetoUSD * (pct / 100);
  const montoConRARS = montoNetoARS + recargoARS;
  const montoConRUSD = montoNetoUSD + recargoUSD;

  const rows = [
    { label: "MONTO NETO", ars: montoNetoARS, usd: montoNetoUSD },
    { label: "RECARGO", ars: recargoARS, usd: recargoUSD },
    { label: "MONTO CON RECARGO", ars: montoConRARS, usd: montoConRUSD },
  ];

  // Add "Valor Cuota" row if installments are more than 1
  if (installments > 1) {
    const valorCuotaARS = montoConRARS / installments;
    const valorCuotaUSD = montoConRUSD / installments;
    rows.push({ label: `VALOR CUOTA (${installments}x)`, ars: valorCuotaARS, usd: valorCuotaUSD });
  }


  const handleCopy = async () => {
    const success = await copyToClipboard(
      buildTableText(title, pct, rows, amountType),
      buildTableHtml(title, pct, rows, amountType),
    );
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <table className="w-full text-sm border-collapse overflow-hidden rounded-md">
      <thead>
        <tr className="bg-blue-600 text-white">
          <th className="text-left px-2 py-1.5 font-semibold">
            {title} ({pct}%)
          </th>
          <th className="text-right px-2 py-1.5 font-semibold">$ARG</th>
          <th className="text-right px-2 py-1.5 font-semibold">
            <div className="flex items-center justify-end gap-1.5">
              <span>USD</span>
              <button
                type="button"
                onClick={handleCopy}
                title="Copiar tabla"
                className="p-1 rounded hover:bg-white/20 focus:outline-none focus:ring-1 focus:ring-white"
              >
                {copied ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, idx) => (
          <tr key={row.label} className={idx % 2 === 0 ? "bg-gray-50" : "bg-white"}>
            <td className="px-2 py-1.5 font-medium text-gray-700">{row.label}</td>
            <td className="px-2 py-1.5 text-right text-gray-800">
              {formatNumber(row.ars)}
            </td>
            <td className="px-2 py-1.5 text-right text-gray-800">
              {formatNumber(row.usd)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

const CuotasCalculator = ({
  cuotaType, // "cuota1", "cuotaSimple3", "cuotaSimple6"
  montoNetoARS,
  montoNetoUSD,
  amountType,
  // eslint-disable-next-line no-unused-vars
  onClose, // Función para cerrar la calculadora
}) => {
  const [cuotaRates, setCuotaRates] = useState(() =>
    Object.fromEntries(
      CUOTA_DEFINITIONS.map((rate) => [rate.varKey, rate.defaultPct]),
    ),
  );

  useEffect(() => {
    const fetchCuotaRates = async () => {
      try {
        const results = await Promise.all(
          CUOTA_DEFINITIONS.map((rate) =>
            window.ZOHO.CRM.API.getOrgVariable(rate.varKey),
          ),
        );
        setCuotaRates((prev) => {
          const next = { ...prev };
          results.forEach((result, idx) => {
            const value = parseFloat(result?.Success?.Content);
            if (!isNaN(value)) {
              next[CUOTA_DEFINITIONS[idx].varKey] = value;
            }
          });
          return next;
        });
      } catch (error) {
        console.error("Error obteniendo variables de cuotas:", error);
      }
    };
    fetchCuotaRates();
  }, []);

  const selectedCuota = CUOTA_DEFINITIONS.find(c => c.id === cuotaType);
  const amountLabel = amountType === 'primerPago' ? '1er Pago' : 'Total';

  if (!selectedCuota) {
    return (
      <div className="shadow-xl p-4 rounded-xl bg-white h-full flex items-center justify-center">
        <p className="text-red-500">Tipo de cuota no válido.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 shadow-xl p-4 rounded-xl bg-white h-full overflow-y-auto">
      <div className="flex justify-between items-start">
        <h3 className="text-lg font-semibold text-gray-800">
          Calculadora de cuotas - TyM Argentina
        </h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">&times;</button>
      </div>

      <div className="space-y-3">
        <p className="text-sm text-gray-600">
          Mostrando cálculo para <span className="font-bold">{selectedCuota.title}</span> sobre <span className="font-bold">{amountLabel}</span>.
        </p>
        <RateTable
          title={selectedCuota.title}
          pct={cuotaRates[selectedCuota.varKey]}
          montoNetoARS={montoNetoARS}
          montoNetoUSD={montoNetoUSD}
          amountType={amountType}
          installments={selectedCuota.installments}
        />
      </div>
    </div>
  );
};

export default CuotasCalculator;
