import "./App.css";
import "./index.css";
import CuotasCalculator from "./CuotasCalculator"; // 1. Importar la calculadora
import React, { useState, useEffect, useRef } from "react";

function App({ data }) {
  const { Entity: module, EntityId: registerID } = data;

  // Nombres de los campos que necesitamos
  const fieldApiNames = [
    "Correo_electr_nico",
    "Tel_fono",
    "Tipo_de_persona",
    "Edad",
    "Nombre_y_Apellidos_Empresa",
    "DNI_NIF_CIF",
    "Coord",
    "Gestor_a",
    "Primer_pago_moneda_principal",
    "Primer_pago_moneda_local",
    "Cuenta_Bancaria_1er_Pago",
    // --- Campos con visibilidad condicional o menos prioritarios ---
    "Direcci_n_de_facturaci_n",
    "Web_Origen", // Campo oculto, pero necesario para la lógica.
    "Comentarios_1er_Pago_LATAM_Extendido",
    "Comunidad_autonoma",
    "Vendedor",
    "Referencia_Cliente",
    "Importe_final_moneda_local1",
  ];

  const picklistFields = [
    "Edad",
    "Tipo_de_persona",
    "Web_Origen",
    "Cuenta_Bancaria_1er_Pago",
    "Gestor_a",
    "Coord",
    "Comunidad_autonoma",
    "Vendedor",
  ];

  const fieldLabels = {
    "Edad": "Edad",
    "Direcci_n_de_facturaci_n": "Dirección de Facturación",
    "Tipo_de_persona": "Tipo de Persona",
    "Nombre_y_Apellidos_Empresa": "Nombre y Apellidos o Empresa",
    "DNI_NIF_CIF": "DNI / NIF / CIF",
    "Web_Origen": "Web de Origen",
    "Cuenta_Bancaria_1er_Pago": "Cuenta Bancaria (Primer Pago)",
    "Gestor_a": "Gestor/a",
    "Comentarios_1er_Pago_LATAM_Extendido": "Comentarios Primer Pago (LATAM)",
    "Primer_pago_moneda_principal": "Primer Pago (Moneda Principal)",
    "Primer_pago_moneda_local": "Primer Pago (Moneda Local)",
    "Coord": "Coordinador/a",
    "Comunidad_autonoma": "Comunidad Autónoma",
    "Correo_electr_nico": "Correo Electrónico",
    "Tel_fono": "Teléfono",
    "Vendedor": "Vendedor",
    "Referencia_Cliente": "Referencia Cliente",
    "Importe_final_moneda_local1": "Importe Final (Moneda Local)",
  };

  const [formData, setFormData] = useState(null);
  const [picklistOptions, setPicklistOptions] = useState({});
  const [highlightedField, setHighlightedField] = useState(null);
  const [loading, setLoading] = useState(true);  const [filesToUpload, setFilesToUpload] = useState([]);
  const [filePreviewUrl, setFilePreviewUrl] = useState(null);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [error, setError] = useState(null);
  const [existingFiles, setExistingFiles] = useState([]);
  const [previewingFile, setPreviewingFile] = useState(null);
  const [popup, setPopup] = useState({ show: false, message: "", isError: false });
  const [isPhoneUnverified, setIsPhoneUnverified] = useState(false);
  
  // 2. Estado para manejar la calculadora
  const [calculatorState, setCalculatorState] = useState({
    isOpen: false,
    props: {},
  });

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);

        // 1. Obtener la información del registro
        const recordResponse = await window.ZOHO.CRM.API.getRecord({
          Entity: module,
          RecordID: registerID,
        });
        const recordData = recordResponse.data[0];

        // 2. Obtener la metadata de los campos del módulo (para los picklists)
        const fieldsResponse = await window.ZOHO.CRM.META.getFields({
          Entity: module,
        });
        
        const availablePicklists = {};
        fieldsResponse.fields
          .filter((field) => picklistFields.includes(field.api_name))
          .forEach((field) => {
            availablePicklists[field.api_name] = field.pick_list_values || [];
          });

        // Es crucial tener las opciones de picklist ANTES de setear el form data
        // para poder mapear los valores de texto a los IDs.
        setPicklistOptions(availablePicklists);

        const initialFormData = {};
        fieldApiNames.forEach((apiName) => {
          const value = recordData[apiName];

          if (value && typeof value === 'object' && value.id) {
            // Caso 1: Campo Lookup (como 'Vendedor'). Zoho devuelve {name, id}. Usamos el id.
            initialFormData[apiName] = value.id;
          } else if (picklistFields.includes(apiName) && typeof value === 'string' && availablePicklists[apiName]) {
            // Caso 2: Campo Picklist. Zoho devuelve el texto. Buscamos el ID correspondiente.
            const options = availablePicklists[apiName] || [];
            const selectedOption = options.find(opt => opt.display_value === value);
            initialFormData[apiName] = selectedOption ? selectedOption.actual_value : "";
          } else {
            // Caso 3: Campo normal (texto, número, etc.)
            initialFormData[apiName] = value !== null && value !== undefined ? value : "";
          }
        });
        initialFormData["Cotizacion_USD_EUR"] = recordData["Cotizacion_USD_EUR"] || 0;
        initialFormData["Referencia_Cliente"] = recordData["Referencia_Cliente"] || "";
        initialFormData["Importe_final_moneda_local1"] = recordData["Importe_final_moneda_local1"] || 0;
        setFormData(initialFormData);

        // Verificar si el teléfono tiene un prefijo no reconocido
        const phoneNumber = initialFormData.Tel_fono || '';
        if (phoneNumber && !phoneAreaCodes.some(area => phoneNumber.startsWith(area.code))) {
          setIsPhoneUnverified(true);
        }

        // Abrir automáticamente la calculadora si se cumplen las condiciones
        const initialWebOrigen = initialFormData.Web_Origen || "";
        const initialCuentaBancariaValue = (availablePicklists["Cuenta_Bancaria_1er_Pago"]?.find(
          opt => opt.actual_value === initialFormData.Cuenta_Bancaria_1er_Pago
        )?.display_value || "").toUpperCase();
        
        if (initialWebOrigen.toLowerCase() === "tym argentina" && initialCuentaBancariaValue.includes("PAYWAY")) {
          const cotizacion = parseFloat(initialFormData.Cotizacion_USD_EUR) || 1;
          const montoARS = parseFloat(String(initialFormData.Primer_pago_moneda_local).replace(/\s/g, '').replace(',', '.')) || 0;
          const montoUSD = montoARS / cotizacion;

          setCalculatorState({ isOpen: true, props: { cuotaType: 'cuota1', montoNetoARS: montoARS, montoNetoUSD: montoUSD, amountType: 'primerPago' } });
        }

      } catch (err) {
        console.error(err);
        setError("Hubo un error al cargar los datos.");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [module, registerID]);

  // Definimos los códigos de área fuera del useEffect para que estén disponibles en el scope del componente
  const phoneAreaCodes = [
    { code: "+34", country: "España" },
    { code: "+549", country: "Argentina" },
    { code: "+52", country: "México" },
    { code: "+56", country: "Chile" },
    { code: "+57", country: "Colombia" },
    { code: "+507", country: "Panamá" },
    { code: "+1", country: "EE.UU./Canadá" }
  ];


  const formatNumber = (value) => {
    if (value === null || value === undefined) return "";
    let [integerPart, decimalPart] = value.toString().split('.');
    integerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return decimalPart !== undefined ? `${integerPart}.${decimalPart}` : integerPart;
  };

  const getFilteredBankAccounts = (webOrigen, allAccounts) => {
    if (!webOrigen || !allAccounts) {
      return [];
    }

    let filtered = [];
    const webOrigenLower = webOrigen.toLowerCase();

    if (webOrigenLower.startsWith("tym ")) {
      // Todas las webs "TyM " comparten las cuentas que inician con "LATAM"
      filtered.push(...allAccounts.filter(acc => acc.display_value.startsWith("LATAM")));

      if (webOrigenLower === "tym argentina") {
        filtered.push(...allAccounts.filter(acc => acc.display_value.startsWith("ARG ") || acc.display_value.startsWith("ARG-")));
      } else if (webOrigenLower === "tym chile") {
        filtered.push(...allAccounts.filter(acc => acc.display_value.startsWith("CL ") || acc.display_value.startsWith("CL-")));
      } else if (webOrigenLower === "tym colombia") {
        filtered.push(...allAccounts.filter(acc => acc.display_value.startsWith("COL ") || acc.display_value.startsWith("COL-")));
      } else if (webOrigenLower.includes("tym pan")) {
        filtered.push(...allAccounts.filter(acc => acc.display_value.startsWith("PAN ") || acc.display_value.startsWith("PAN-")));
      } else if (webOrigenLower === "tym méxico" || webOrigenLower === "tym mexico") {
        filtered.push(...allAccounts.filter(acc => acc.display_value.startsWith("MX ") || acc.display_value.startsWith("MX-")));
      }
    } else {
      // Todas las webs que no son TyM, mapear las cuentas que empiezan con "ESP " o "ESP-"
      filtered = allAccounts.filter(acc => acc.display_value.startsWith("ESP ") || acc.display_value.startsWith("ESP-"));
    }

    // Todas las web disponen de la posibilidad del valor OTROS en el picklist
    const otrosAccount = allAccounts.find(acc => acc.display_value.toUpperCase() === "OTROS");
    if (otrosAccount && !filtered.some(acc => acc.actual_value === otrosAccount.actual_value)) {
      filtered.push(otrosAccount);
    }

    // Devolvemos un array único para evitar duplicados si alguna lógica se solapa
    return [...new Map(filtered.map(item => [item.actual_value, item])).values()];
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setHighlightedField(null); // Reseteamos el resaltado en cada cambio manual

    if (name === "Tel_fono") {
      setIsPhoneUnverified(false); // El usuario ha interactuado, quitamos la advertencia
    }


    setFormData((prev) => {
      let newFormData = { ...prev };
      const cotizacion = parseFloat(prev.Cotizacion_USD_EUR) || 0;

      if (name === "Primer_pago_moneda_local" || name === "Primer_pago_moneda_principal") {
        // Permitimos escribir la coma o el punto, pero lo tratamos como punto.
        const cleanValue = value.replace(/\s/g, '').replace(',', '.');
        
        // Si el valor no es un número válido (ej. "123."), lo guardamos tal cual para permitir seguir escribiendo.
        if (isNaN(parseFloat(cleanValue)) && cleanValue.slice(-1) !== '.') {
            newFormData[name] = '';
        } else {
            newFormData[name] = cleanValue;
        }

        const numericValue = parseFloat(cleanValue) || 0;

        if (cotizacion > 0) {
          if (name === "Primer_pago_moneda_local") {
            newFormData.Primer_pago_moneda_principal = (numericValue / cotizacion).toFixed(2);
            setHighlightedField("Primer_pago_moneda_principal");
          } else { // Es Primer_pago_moneda_principal
            newFormData.Primer_pago_moneda_local = (numericValue * cotizacion).toFixed(2);
            setHighlightedField("Primer_pago_moneda_local");
          }
        }
      } else {
        newFormData[name] = value;
      }
      return newFormData;
    });
  };

  const isValidEmail = (email) => {
    // Expresión regular simple para validación de correo electrónico
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // --- Validación de campos obligatorios ---
    const webOrigen = formData?.Web_Origen || "";
    const showTymFields = webOrigen.startsWith("TyM ");
    const showComunidadAutonoma = ["Tu Prog Didáctica", "TPD", "Tu Prog Didactica"].includes(webOrigen);

    const visibleFields = fieldApiNames.filter(apiName => {
        if (apiName === "Web_Origen") return false;
        if (apiName === "Comentarios_1er_Pago_LATAM_Extendido" && !showTymFields) return false;
        if (apiName === "Primer_pago_moneda_local" && !showTymFields) return false;
        if (apiName === "Vendedor" && showTymFields) return false;
        if (apiName === "Comunidad_autonoma" && !showComunidadAutonoma) return false;
        return true;
    });

    const emptyFields = visibleFields.filter(apiName => {
        const value = formData[apiName];
        return value === null || value === undefined || value === "";
    });

    if (emptyFields.length > 0) {
        const fieldLabelsList = emptyFields.map(apiName => fieldLabels[apiName] || apiName).join(', ');
        setPopup({ show: true, message: `Por favor, completa los siguientes campos obligatorios: ${fieldLabelsList}`, isError: true });
        return;
    }

    // --- Validación de archivo adjunto ---
    if (filesToUpload.length === 0 && existingFiles.length === 0) {
      setPopup({ show: true, message: "Por favor, adjunta un archivo. Es obligatorio.", isError: true });
      return;
    }

    // Validación de correo electrónico
    if (formData.Correo_electr_nico && !isValidEmail(formData.Correo_electr_nico)) {
      setPopup({ show: true, message: "Por favor, introduce un formato de correo electrónico válido.", isError: true });
      return; // Detenemos el envío
    }

    setLoading(true);
    try {
      // Excluimos el campo de cotización del envío para no sobreescribirlo si no es necesario
      const { Cotizacion_USD_EUR, ...dataFromForm } = formData;
      
      // Nos aseguramos que los valores de moneda se envíen como números sin formato
      const dataToSubmit = {
        ...dataFromForm,
        id: registerID, // Añadimos el ID del registro aquí
        Primer_pago_moneda_principal: parseFloat(String(dataFromForm.Primer_pago_moneda_principal).replace(/\s/g, '').replace(',', '.')) || 0,
        Primer_pago_moneda_local: parseFloat(String(dataFromForm.Primer_pago_moneda_local).replace(/\s/g, '').replace(',', '.')) || 0,
      };

      const updateData = {
        Entity: module,
        RecordID: registerID,
        APIData: dataToSubmit,
      };

      await window.ZOHO.CRM.API.updateRecord(updateData);

      if (filesToUpload.length > 0) {
        for (const file of filesToUpload) {
          const fileConfig = {
            Entity: module,
            RecordID: registerID,
            File: {
              Name: file.name,
              Content: file,
            },
          };
          await window.ZOHO.CRM.API.attachFile(fileConfig);
        }
      }

      // 4. Mostrar mensaje de éxito. El blueprint se ejecutará al cerrar el popup.
      setPopup({ show: true, message: "¡Trato cerrado y propuesta ganada con éxito!", isError: false });
    } catch (err) {
      console.error("Error al actualizar o ejecutar el blueprint:", err);      
      let errorMessage = "No se pudo actualizar el registro.";
      if (err.data && err.data[0] && err.data[0].message) {
        errorMessage += `\n\nError de Zoho: ${err.data[0].message}`;
      }
      
      // Usamos el nuevo popup para mostrar el error en lugar de la vista de error principal
      // setError(errorMessage); 
      // alert(errorMessage);
      setPopup({ show: true, message: errorMessage, isError: true });

    } finally {
      setLoading(false);
    }
  };

  const handlePreviewExistingFile = async (file) => {
    try {
      const fileContent = await window.ZOHO.CRM.API.downloadFile({ id: file.id });
      const fileType = file.File_Name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'; // Asumimos jpeg si no es pdf
      const blob = new Blob([fileContent], { type: fileType });
      const url = URL.createObjectURL(blob);
      setPreviewingFile({
        url: url,
        type: fileType,
        name: file.File_Name,
      });
      setIsPreviewModalOpen(true);
    } catch (err) {
      console.error("Error al descargar el archivo para previsualizar:", err);
      setPopup({ show: true, message: "No se pudo previsualizar el archivo.", isError: true });
    }
  };

  const handleDeleteExistingFile = async (fileId) => {
    if (window.confirm("¿Estás seguro de que quieres eliminar este archivo permanentemente?")) {
      try {
        await window.ZOHO.CRM.API.deleteFile({ id: fileId });
        setExistingFiles(prevFiles => prevFiles.filter(f => f.id !== fileId));
        setPopup({ show: true, message: "Archivo eliminado con éxito.", isError: false });
      } catch (err) {
        console.error("Error al eliminar el archivo:", err);
        setPopup({ show: true, message: "No se pudo eliminar el archivo.", isError: true });
      }
    }
  };

  const closePreviewModal = () => {
    setIsPreviewModalOpen(false);
    setPreviewingFile(null); // Limpiamos el estado del archivo en previsualización
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-white bg-opacity-75 flex items-center justify-center z-50">
        <div className="animate-spin rounded-full h-32 w-32 border-t-4 border-b-4 border-indigo-600"></div>
      </div>
    );
  }

  if (error) {
    return <div className="App error">{error}</div>;
  }

  // Opciones filtradas para la cuenta bancaria
  const bankAccountOptions = getFilteredBankAccounts(
    formData?.Web_Origen,
    picklistOptions["Cuenta_Bancaria_1er_Pago"]
  );

  // Condiciones para mostrar campos
  const webOrigen = formData?.Web_Origen || "";
  const showTymFields = webOrigen.startsWith("TyM ");
  const showComunidadAutonoma = ["Tu Prog Didáctica", "TPD", "Tu Prog Didactica"].includes(webOrigen);
  
  // Condición para mostrar la calculadora
  const cuentaBancariaValue = picklistOptions["Cuenta_Bancaria_1er_Pago"]?.find(
    opt => opt.actual_value === formData?.Cuenta_Bancaria_1er_Pago
  )?.display_value || "";
  const isPaywayAccount = cuentaBancariaValue.toUpperCase().includes("PAYWAY");
  const isFiservAccount = cuentaBancariaValue.toUpperCase().includes("FISERV");
  const showCalculator =
    webOrigen.toLowerCase() === "tym argentina" &&
    (isPaywayAccount || isFiservAccount);

  // Componente para el picklist con buscador
  const SearchablePicklist = ({ options, value, onChange, name, placeholder = "-- Seleccione --" }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const wrapperRef = useRef(null);
    const listRef = useRef(null);

    useEffect(() => {
      if (isOpen && listRef.current) {
        const selectedItem = listRef.current.querySelector('.bg-indigo-100');
        selectedItem?.scrollIntoView({ block: 'nearest' });
      }
    }, [isOpen]);

    const selectedOption = options.find(opt => opt.actual_value === value);

    useEffect(() => {
      function handleClickOutside(event) {
        if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
          setIsOpen(false);
        }
      }
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }, [wrapperRef]);

    useEffect(() => {
      if (selectedOption) {
        setSearchTerm(selectedOption.display_value);
      } else {
        setSearchTerm("");
      }
    }, [value, selectedOption]);

    const filteredOptions = options.filter(option =>
      option.display_value.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleSelectOption = (optionValue) => {
      onChange({ target: { name, value: optionValue } });
      setIsOpen(false);
    };

    return (
      <div className="relative" ref={wrapperRef}>
        <input
          type="text"
              value={isOpen ? searchTerm : (selectedOption?.display_value || '')}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => {
            setIsOpen(true);
            setSearchTerm(''); // Limpiar al enfocar para mostrar todas las opciones
          }}
          placeholder={placeholder}
              className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-sm shadow-sm placeholder-gray-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
        />
        {isOpen && (
          <ul ref={listRef} className="absolute z-10 w-full bg-white border rounded mt-1 max-h-60 overflow-y-auto shadow-lg">
            {filteredOptions.length > 0 ? (
                  filteredOptions.map((option) => (
                <li key={option.actual_value} onMouseDown={() => handleSelectOption(option.actual_value)} className={`px-3 py-2 cursor-pointer hover:bg-gray-100 ${option.actual_value === value ? 'bg-indigo-100 font-bold' : ''}`}>
                  {option.display_value}
                </li>
              ))
            ) : (<li className="px-3 py-2 text-gray-500">No se encontraron opciones</li>)}
          </ul>
        )}
      </div>
    );
  };

  // Componente para el Tooltip de ayuda
  const Tooltip = ({ text }) => {
    return (
      <div className="relative flex items-center">
        <div className="group">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400 group-hover:text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="absolute top-full mt-2 hidden group-hover:block bg-gray-800 text-white text-xs rounded py-2 px-3 z-10 w-max max-w-xs">
            <p className="font-bold mb-1">Códigos de área comunes:</p>
            <ul className="list-disc list-inside">
              {text.map(item => <li key={item.code}>{item.country}: {item.code}</li>)}
            </ul>
          </div>
        </div>
      </div>
    );
  };

  // 3. Función para abrir la calculadora con las props adecuadas
  const openCalculator = (cuotaType, amountType) => {
    const cotizacion = parseFloat(formData.Cotizacion_USD_EUR) || 1;
    const montoARS = amountType === 'primerPago' 
      ? parseFloat(String(formData.Primer_pago_moneda_local).replace(/\\s/g, '').replace(',', '.')) || 0
      : parseFloat(String(formData.Importe_final_moneda_local1).replace(/\\s/g, '').replace(',', '.')) || 0;

    const montoUSD = montoARS / cotizacion;

    setCalculatorState({
      isOpen: true,
      props: {
        cuotaType,
        montoNetoARS: montoARS,
        montoNetoUSD: montoUSD,
        amountType, // Pasamos el tipo de monto a la calculadora
      },
    });
  };

  return (
    <div className="App min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4 text-gray-800">
      <form
        onSubmit={handleSubmit}
        className="bg-white p-8 rounded-lg shadow-md w-full max-w-4xl"
      >
        <h2 className="text-2xl font-bold mb-8 text-center text-gray-800">
          Cerrar trato y marcar propuesta ganada: {formData?.Referencia_Cliente}
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6">
          {fieldApiNames.map((apiName) => {
            // Lógica de visibilidad condicional
            if (apiName === "Web_Origen") {
              return null;
            }
            if (apiName === "Referencia_Cliente") {
              return null; // No mostramos este campo en el formulario
            }
            if (apiName === "Comentarios_1er_Pago_LATAM_Extendido" && !showTymFields) {
              return null;
            }
            if (apiName === "Primer_pago_moneda_local" && !showTymFields) {
              return null;
            }
            if (apiName === "Vendedor" && showTymFields) {
              return null;
            }
            if (apiName === "Comunidad_autonoma" && !showComunidadAutonoma) {
              return null;
            }
            if (apiName === "Importe_final_moneda_local1") {
              return null; // No se muestra en el formulario, solo se usa para la calculadora
            }

            const fieldElement = (
              <div key={apiName} className="mb-4">
                <label
                  htmlFor={apiName}                className="flex items-center gap-2 text-sm font-medium text-gray-700"
                >
                  {fieldLabels[apiName] || apiName.replace(/_/g, " ")}
                  {apiName === "Tel_fono" && <Tooltip text={phoneAreaCodes} />}
                </label>
                {apiName === 'Primer_pago_moneda_local' && formData?.Cotizacion_USD_EUR > 0 && (
                  <p className="text-xs text-gray-500 -mt-1 mb-2">
                    Cotización de referencia: <span className="font-semibold">{formData.Cotizacion_USD_EUR}</span>
                  </p>
                )}
                {apiName === "Comentarios_1er_Pago_LATAM_Extendido" ? (
                  <div>
                    <textarea
                      id={apiName}
                      name={apiName}
                      value={formData[apiName] || ""}
                      onChange={handleInputChange}
                      maxLength="1900"
                      className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-sm shadow-sm placeholder-gray-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 h-24"
                    />
                    <p className="text-right text-xs text-gray-500 mt-1">
                      {formData[apiName]?.length || 0} / 1900
                    </p>
                  </div>
                ) : apiName.startsWith("Primer_pago_moneda") ? (
                  <input
                    type="text"
                    inputMode="decimal"
                    id={apiName}
                    name={apiName}
                    value={formatNumber(formData[apiName])}
                    onChange={handleInputChange}
                    onWheel={(e) => e.target.blur()}
                    className={`mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-sm shadow-sm placeholder-gray-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 ${
                      highlightedField === apiName ? "text-red-500 font-bold border-red-400" : ""
                    }`}
                  />
                ) : picklistOptions[apiName] ? (
                  <SearchablePicklist
                    name={apiName}
                    value={formData[apiName]}
                    onChange={handleInputChange}
                    options={apiName === "Cuenta_Bancaria_1er_Pago" ? bankAccountOptions : picklistOptions[apiName]}
                  />
                ) : <input
                  type="text"
                  id={apiName}
                  name={apiName}
                  value={formData[apiName] || ""}
                  onChange={handleInputChange}
                  className={`mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md text-sm shadow-sm placeholder-gray-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 ${apiName === 'Tel_fono' && isPhoneUnverified ? 'border-amber-500 ring-amber-500 animate-pulse-border' : ''}`}
                />}
                {apiName === "Tel_fono" && (
                  <p className="text-xs text-gray-500 mt-1">Verifique si el número de teléfono tiene código de área.</p>
                )}
              </div>
            );

            if (apiName === "Direcci_n_de_facturaci_n") {
              return (
                <React.Fragment key={apiName}>
                  {fieldElement}
                  {showCalculator && (
                    <div className="md:col-span-2 border-t pt-4 my-4">
                      <h3 className="text-lg font-medium text-gray-800 mb-3">Calculadora de Cuotas</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <h4 className="text-sm font-semibold text-gray-600 mb-2">Sobre 1er Pago</h4>
                          <div className="flex flex-wrap gap-2">
                            {isPaywayAccount && (
                              <>
                                <button type="button" onClick={() => openCalculator('cuota1', 'primerPago')} className="px-3 py-1.5 text-xs rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200">CS1</button>
                                <button type="button" onClick={() => openCalculator('cuotaSimple3', 'primerPago')} className="px-3 py-1.5 text-xs rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200">CS3</button>
                                <button type="button" onClick={() => openCalculator('cuotaSimple6', 'primerPago')} className="px-3 py-1.5 text-xs rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200">CS6</button>
                              </>
                            )}
                            {isFiservAccount && (
                              <>
                                <button type="button" onClick={() => openCalculator('cuotaSimple9', 'primerPago')} className="px-3 py-1.5 text-xs rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200">CS9</button>
                                <button type="button" onClick={() => openCalculator('cuotaSimple12', 'primerPago')} className="px-3 py-1.5 text-xs rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200">CS12</button>
                              </>
                            )}
                          </div>
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold text-gray-600 mb-2">Sobre Total</h4>
                          <div className="flex flex-wrap gap-2">
                            {isPaywayAccount && (
                              <>
                                <button type="button" onClick={() => openCalculator('cuota1', 'total')} className="px-3 py-1.5 text-xs rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200">CS1</button>
                                <button type="button" onClick={() => openCalculator('cuotaSimple3', 'total')} className="px-3 py-1.5 text-xs rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200">CS3</button>
                                <button type="button" onClick={() => openCalculator('cuotaSimple6', 'total')} className="px-3 py-1.5 text-xs rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200">CS6</button>
                              </>
                            )}
                            {isFiservAccount && (
                              <>
                                <button type="button" onClick={() => openCalculator('cuotaSimple9', 'total')} className="px-3 py-1.5 text-xs rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200">CS9</button>
                                <button type="button" onClick={() => openCalculator('cuotaSimple12', 'total')} className="px-3 py-1.5 text-xs rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200">CS12</button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </React.Fragment>
              );
            }

            return fieldElement;
          })}
        </div>
        {existingFiles.length > 0 && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Archivos Adjuntos Existentes</label>
            <ul className="border rounded-lg p-3 bg-gray-50 space-y-2">
              {existingFiles.map(file => (
                <li key={file.id} className="flex justify-between items-center text-sm">
                  <span className="text-gray-700 truncate pr-2">{file.File_Name}</span>
                  <div className="flex-shrink-0">
                    <button type="button" onClick={() => handlePreviewExistingFile(file)} className="px-2 py-1 text-xs font-semibold rounded-md text-indigo-600 hover:bg-indigo-100 mr-2">VER</button>
                    <button type="button" onClick={() => handleDeleteExistingFile(file.id)} className="px-2 py-1 text-xs font-semibold rounded-md text-red-600 hover:bg-red-100">QUITAR</button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="mb-4">
          <label htmlFor="file-upload" className="block text-sm font-medium text-gray-700">
            Adjuntar Archivo
          </label>
          <input
            id="file-upload"
            type="file"
            onChange={e => {
              const newFile = e.target.files[0];
              if (newFile) {
                setFilesToUpload(prevFiles => [...prevFiles, newFile]);

                // Mostrar previsualización obligatoria del primer archivo seleccionado
                if (newFile.type.startsWith("image/") || newFile.type === "application/pdf") {
                  const url = URL.createObjectURL(newFile);
                  setPreviewingFile({ url, type: newFile.type, name: newFile.name });
                  setIsPreviewModalOpen(true);
                }
              }
              // Limpiar el valor para poder seleccionar el mismo archivo de nuevo
              e.target.value = '';
            }}
            className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
          />
        </div>
        {filesToUpload.length > 0 && (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Archivos a Subir</label>
            <ul className="border rounded-lg p-3 bg-gray-50 space-y-2">
              {filesToUpload.map((file, index) => (
                <li key={`${file.name}-${index}`} className="flex justify-between items-center text-sm">
                  <span className="text-gray-700 truncate pr-2">{file.name}</span>
                  <div className="flex-shrink-0">
                    <button 
                      type="button" 
                      onClick={() => {
                        const url = URL.createObjectURL(file);
                        setPreviewingFile({ url, type: file.type, name: file.name });
                        setIsPreviewModalOpen(true);
                      }} 
                      className="px-2 py-1 text-xs font-semibold rounded-md text-indigo-600 hover:bg-indigo-100 mr-2"
                    >
                      VER
                    </button>
                    <button type="button" onClick={() => setFilesToUpload(files => files.filter((_, i) => i !== index))} className="px-2 py-1 text-xs font-semibold rounded-md text-red-600 hover:bg-red-100">QUITAR</button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:bg-gray-400 disabled:cursor-not-allowed mt-6"
        >
          {loading ? "Actualizando..." : "Actualizar a propuesta ganada"}
        </button>
        {popup.show && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-sm text-center">
              <p className={`text-lg mb-4 ${popup.isError ? 'text-red-600' : 'text-gray-800'}`}>{popup.message}</p>
              <button
                onClick={() => {
                  setPopup({ show: false, message: "", isError: false });
                  if (!popup.isError) {
                    // Al cerrar el popup de éxito, ejecutamos el blueprint.
                    window.ZOHO.CRM.BLUEPRINT.proceed();
                  }
                }}
                className={`w-full font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline ${
                  popup.isError ? 'bg-red-500 hover:bg-red-700 text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                }`}
              >
                Cerrar
              </button>
            </div>
          </div>
        )}
      </form>
      {/* 5. Lógica para renderizar la calculadora en un modal/overlay */}
      {calculatorState.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="w-full max-w-md">
                <CuotasCalculator
                    {...calculatorState.props}
                    onClose={() => setCalculatorState({ isOpen: false, props: {} })}
                />
            </div>
        </div>
      )}

      {isPreviewModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-4 rounded-lg max-w-4xl w-full max-h-[90vh] flex flex-col">
            <div className="flex-grow overflow-auto relative">
              <button
                onClick={closePreviewModal}
                className="absolute top-2 right-2 z-10 bg-black bg-opacity-40 text-white rounded-full w-8 h-8 flex items-center justify-center text-2xl font-bold hover:bg-black hover:bg-opacity-60 transition-colors"
                aria-label="Cerrar previsualización"
              >
                &times;
              </button>
              {previewingFile?.type.startsWith("image/") && (
                <img src={previewingFile.url} alt={`Previsualización de ${previewingFile.name}`} className="w-full h-auto rounded" />
              )}
              {previewingFile?.type === "application/pdf" && (
                <object data={previewingFile.url} type="application/pdf" className="w-full h-[75vh]" />
              )}
            </div>
            <div className="flex-shrink-0 pt-4 text-center">
              <button
                onClick={closePreviewModal}
                className="px-6 py-2 bg-indigo-600 text-white font-semibold rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Continuar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
