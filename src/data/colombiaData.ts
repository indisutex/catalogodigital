export interface CiudadMunicipio {
  departamento: string;
  ciudad: string;
  cobertura: boolean;
  costoEnvio?: number;
}

export const DEPARTAMENTOS_COLOMBIA: Record<string, string[]> = {
  "Amazonas": ["Leticia", "Puerto Nariño"],
  "Antioquia": ["Medellín", "Bello", "Itagüí", "Envigado", "Rionegro", "Apartadó", "Turbo", "Caucasia", "Sabatenas", "Caldas", "Copacabana", "La Estrella", "Girardota", "Marinilla", "Guarne", "La Ceja", "El Retiro", "Sonsón", "Yarumal", "Santa Fe de Antioquia", "Puerto Berrío"],
  "Arauca": ["Arauca", "Tame", "Saravena", "Arauquita"],
  "Atlántico": ["Barranquilla", "Soledad", "Malambo", "Sabanalarga", "Baranoa", "Puerto Colombia", "Galapa"],
  "Bogotá D.C.": ["Bogotá D.C."],
  "Bolívar": ["Cartagena", "Magangué", "Turbaco", "Arjona", "El Carmen de Bolívar", "Mompox"],
  "Boyacá": ["Tunja", "Sogamoso", "Duitama", "Chiquinquirá", "Paipa", "Moniquirá", "Villa de Leyva", "Puerto Boyacá"],
  "Caldas": ["Manizales", "Villamaría", "Chinchiná", "Riosucio", "La Dorada", "Anserma"],
  "Caquetá": ["Florencia", "San Vicente del Caguán", "Puerto Rico"],
  "Casanare": ["Yopal", "Aguazul", "Villanueva", "Paz de Ariporo"],
  "Cauca": ["Popayán", "Santander de Quilichao", "Puerto Tejada", "Patía", "Piendamó"],
  "Cesar": ["Valledupar", "Aguachica", "Agustín Codazzi", "Bosconia", "Curumaní"],
  "Chocó": ["Quibdó", "Istmina", "Tadó", "Condoto"],
  "Córdoba": ["Montería", "Cereté", "Sahagún", "Lorica", "Montelíbano", "Planeta Rica"],
  "Cundinamarca": ["Soacha", "Chía", "Zipaquirá", "Facatativá", "Fusagasugá", "Girardot", "Mosquera", "Funza", "Madrid", "Cajicá", "Sopó", "Tocancipá", "Cota", "Sibate", "Ubate", "Tocaima"],
  "Guainía": ["Inírida"],
  "Guaviare": ["San José del Guaviare", "Calamar"],
  "Huila": ["Neiva", "Pitalito", "Garzón", "La Plata", "Campoalegre"],
  "La Guajira": ["Riohacha", "Maicao", "Uribia", "Fonseca", "San Juan del Cesar"],
  "Magdalena": ["Santa Marta", "Ciénaga", "Fundación", "El Banco", "Plato"],
  "Meta": ["Villavicencio", "Acacías", "Granada", "Puerto López", "Cumaral"],
  "Nariño": ["Pasto", "Ipiales", "Tumaco", "Túquerres", "La Unión"],
  "Norte de Santander": ["Cúcuta", "Ocaña", "Villa del Rosario", "Los Patios", "Pamplona", "Tibú"],
  "Putumayo": ["Mocoa", "Puerto Asís", "Orito", "Sibundoy"],
  "Quindío": ["Armenia", "Calarcá", "La Tebaida", "Circasia", "Salento", "Montenegro", "Quimbaya"],
  "Risaralda": ["Pereira", "Dosquebradas", "Santa Rosa de Cabal", "La Virginia", "Belén de Umbría"],
  "San Andrés y Providencia": ["San Andrés", "Providencia"],
  "Santander": ["Bucaramanga", "Floridablanca", "Girón", "Piedecuesta", "Barrancabermeja", "San Gil", "Socorro", "Barbosa", "Vélez"],
  "Sucre": ["Sincelejo", "Corozal", "San Marcos", "Tolú", "Sampués"],
  "Tolima": ["Ibagué", "Espinal", "Melgar", "Honda", "Mariquita", "Líbano", "Chaparral"],
  "Valle del Cauca": ["Cali", "Palmira", "Buenaventura", "Tuluá", "Cartago", "Jamundí", "Yumbo", "Buga", "Sevilla", "Zarzal", "Florida", "Pradera", "Candelaria", "Roldanillo"],
  "Vaupés": ["Mitú"],
  "Vichada": ["Puerto Carreño", "La Primavera"]
};

// Lista plana ordenada de todas las ciudades/municipios de Colombia para autocompletado rápido
export const TODAS_LAS_CIUDADES_COLOMBIA: { ciudad: string; departamento: string }[] = Object.entries(DEPARTAMENTOS_COLOMBIA).flatMap(
  ([depto, municipios]) => municipios.map(muni => ({ ciudad: `${muni}, ${depto}`, departamento: depto }))
).sort((a, b) => a.ciudad.localeCompare(b.ciudad));
