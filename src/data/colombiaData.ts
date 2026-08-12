export interface CiudadMunicipio {
  departamento: string;
  ciudad: string;
  cobertura: boolean;
  costoEnvio?: number;
}

export const DEPARTAMENTOS_COLOMBIA: Record<string, string[]> = {
  "Amazonas": [
    "Leticia", "Puerto Nariño", "El Encanto", "La Chorrera", "La Pedrera", "Puerto Alegría", "Puerto Arica", "Puerto Santander", "Tarapacá"
  ],
  "Antioquia": [
    "Medellín", "Bello", "Itagüí", "Envigado", "Sabaneta", "Rionegro", "Apartadó", "Turbo", "Caucasia", "Caldas", 
    "Copacabana", "La Estrella", "Girardota", "Marinilla", "Guarne", "La Ceja", "El Retiro", "Sonsón", "Yarumal", 
    "Santa Fe de Antioquia", "Puerto Berrío", "Urrao", "Santa Rosa de Osos", "Chigorodó", "Carepa", "Amalfi", 
    "Andes", "El Carmen de Viboral", "San Jerónimo", "Ciudad Bolívar", "Amagá", "Barbosa", "Donmatías", "Entrerríos", 
    "San Pedro de los Milagros", "Fredonia", "Jardín", "Jericó", "La Unión", "San Carlos", "San Rafael", "Segovia", 
    "Remedios", "Dabeiba", "Necoclí", "San Juan de Urabá", "San Pedro de Urabá", "Mutatá", "Táamesis", "Titiribí", "Venecia"
  ],
  "Arauca": [
    "Arauca", "Tame", "Saravena", "Arauquita", "Puerto Rondón", "Fortul", "Cravo Norte"
  ],
  "Atlántico": [
    "Barranquilla", "Soledad", "Malambo", "Sabanalarga", "Baranoa", "Puerto Colombia", "Galapa", "Tubará", 
    "Luruaco", "Repelón", "Usiacurí", "Santo Tomás", "Sabanagrande", "Palmar de Varela", "Campo de la Cruz", 
    "Manatí", "Polonuevo", "Ponedera", "Candelaria", "Juan de Acosta", "Piojó", "Santa Lucía", "Suan"
  ],
  "Bogotá D.C.": [
    "Bogotá D.C."
  ],
  "Bolívar": [
    "Cartagena", "Magangué", "Turbaco", "Arjona", "El Carmen de Bolívar", "Mompox", "San Juan Nepomuceno", 
    "María La Baja", "Santa Rosa", "Turbana", "San Jacinto", "Mahates", "Clemencia", "Santa Catalina", 
    "Calamar", "Córdoba", "El Guamo", "San Estanislao", "Soplaviento", "Talaigua Nuevo", "Arenal", "Cantagallo", 
    "Morales", "San Pablo", "Santa Rosa del Sur", "Simití"
  ],
  "Boyacá": [
    "Tunja", "Sogamoso", "Duitama", "Chiquinquirá", "Paipa", "Moniquirá", "Villa de Leyva", "Puerto Boyacá", 
    "Guateque", "Soatá", "Samacá", "Ramiriquí", "Garagoa", "Nobsa", "Tibasosa", "Santa Rosa de Viterbo", 
    "Muzo", "Miraflores", "Boavita", "Aquitania", "Arcabuco", "Belén", "Cóombita", "Monguí", "Ráquira", "Sutamarchán", "Tuta", "Ventaquemada"
  ],
  "Caldas": [
    "Manizales", "Villamaría", "Chinchiná", "Riosucio", "La Dorada", "Anserma", "Supía", "Aguadas", 
    "Pensilvania", "Salamina", "Manzanares", "Viterbo", "Neira", "Pácora", "Belalcázar", "Aranzazu", 
    "Filadelfia", "La Merced", "Marmato", "Marquetalia", "Marulanda", "Norcasia", "Palestina", "Risaralda", "Samaná", "Victoria"
  ],
  "Caquetá": [
    "Florencia", "San Vicente del Caguán", "Puerto Rico", "El Paujil", "Belén de los Andaquíes", "Cartagena del Chairá", 
    "Currillo", "El Albanés", "La Montañita", "Morelia", "Puerto Milán", "San José del Fragua", "Solano", "Solita", "Valparaíso"
  ],
  "Casanare": [
    "Yopal", "Aguazul", "Villanueva", "Paz de Ariporo", "Monterrey", "Tauramena", "Maní", "Hato Corozal", 
    "Orocué", "Chámeza", "Hato Corozal", "La Salina", "Nunchía", "Pore", "Recetor", "Sabanalarga", "Sácama", "San Luis de Palenque", "Támara"
  ],
  "Cauca": [
    "Popayán", "Santander de Quilichao", "Puerto Tejada", "Patía", "Piendamó", "Morales", "Corinto", "Caloto", 
    "Guachené", "El Tambo", "Miranda", "Silvia", "Bolívar", "Buenos Aires", "Caldono", "Inzá", "La Sierra", 
    "Mercaderes", "Padilla", "Paéz (Belalcázar)", "Puracé (Coconuco)", "Rosas", "Suárez", "Timbío", "Totoró", "Villa Rica"
  ],
  "Cesar": [
    "Valledupar", "Aguachica", "Agustín Codazzi", "Bosconia", "Curumaní", "La Paz", "Chimichagua", "Chiriguaná", 
    "El Paso", "Pailitas", "San Alberto", "San Martín", "Astrea", "Becerril", "El Copey", "La Gloria", 
    "La Jagua de Ibirico", "Manaure Balcón del Cesar", "Pueblo Bello", "Río de Oro", "San Diego", "Tamalameque"
  ],
  "Chocó": [
    "Quibdó", "Istmina", "Tadó", "Condoto", "Bahía Solano", "Nuquí", "Acandí", "Riosucio", "Alto Baudó", 
    "Bojayá", "Carmen del Darién", "El Cantón de San Pablo", "Litoral del San Juan", "Medio Atrato", "Medio Baudó", "Medio San Juan", "Novita", "Sipí", "Unión Panamericana"
  ],
  "Córdoba": [
    "Montería", "Cereté", "Sahagún", "Lorica", "Montelíbano", "Planeta Rica", "Ciénaga de Oro", "Tierralta", 
    "Ayapel", "San Antero", "Chinú", "San Carlos", "San Pelayo", "Pueblo Nuevo", "Puerto Escondido", 
    "Buenavista", "Canalete", "Cotorra", "La Apartada", "Los Córdobas", "Momil", "Moñitos", "Purísima", "San Bernardo del Viento", "San José de Uré", "Valencia"
  ],
  "Cundinamarca": [
    "Soacha", "Chía", "Zipaquirá", "Facatativá", "Fusagasugá", "Girardot", "Mosquera", "Funza", "Madrid", 
    "Cajicá", "Sopó", "Tocancipá", "Cota", "Sibaté", "Ubaté", "Tocaima", "La Calera", "Guasca", "Tabio", 
    "Tenjo", "Gachancipá", "Nemocón", "Subachoque", "Villeta", "La Vega", "Anapoima", "El Colegio (Mesitas)", 
    "Silvania", "Arbeláez", "Cachipay", "Choachí", "Fómeque", "Sesquilé", "Suesca", "Pacho", "Yacopí", 
    "Agua de Dios", "Ricaurte", "Carmen de Carupa", "Guaduas", "Bojacá", "Cáqueza", "Cogua", "Gachala", "Guatavita", "La Palma", "La Peña", "Lenguazaque", "Nilo", "Nocaima", "Pasca", "Quetame", "San Francisco", "Sasaima", "Simijaca", "Tausa", "Tena", "Tibatá", "Vilachá", "Viotá", "Zipacón"
  ],
  "Guainía": [
    "Inírida", "Barrancominas", "Mapiripana", "San Felipe", "Puerto Colombia", "La Guadalupe", "Cacahual", "Pana Pana", "Morichal"
  ],
  "Guaviare": [
    "San José del Guaviare", "Calamar", "El Retorno", "Miraflores"
  ],
  "Huila": [
    "Neiva", "Pitalito", "Garzón", "La Plata", "Campoalegre", "Gigante", "Rivera", "San Agustín", "Palermo", 
    "Aipe", "Yaguará", "Algeciras", "Timaná", "Villavieja", "Isnos", "Acevedo", "Agrado", "Baraya", "Hobo", 
    "Iquira", "La Argentina", "Nátaga", "Paicol", "Palestina", "Pito", "Saladoblanco", "Santa María", "Suaza", "Tarqui", "Tello", "Teruel", "Tesalia"
  ],
  "La Guajira": [
    "Riohacha", "Maicao", "Uribia", "Fonseca", "San Juan del Cesar", "Manaure", "Albania", "Hatonuevo", 
    "Barrancas", "Dibulla", "Villanueva", "Distracción", "El Molino", "La Jagua del Pilar", "Urumita"
  ],
  "Magdalena": [
    "Santa Marta", "Ciénaga", "Fundación", "El Banco", "Plato", "Aracataca", "Pivijay", "Zona Bananera", 
    "Ariguaní", "Pueblo Viejo", "Sitionuevo", "Algarrobo", "Ariguaní (El Difícil)", "Cerro San Antonio", "Chibolo", "Concordia", "El Piñón", "El Retén", "Guamal", "Nueva Granada", "Pedraza", "Pijiño del Carmen", "Remolino", "Sabanas de San Ángel", "Salamina", "San Zenón", "Santa Ana", "Santa Bárbara de Pinto", "Sitionuevo", "Tenerife"
  ],
  "Meta": [
    "Villavicencio", "Acacías", "Granada", "Puerto López", "Cumaral", "Restrepo", "San Martín", "Puerto Gaitán", 
    "Guamal", "Vista Hermosa", "Mesetas", "Puerto Rico", "Cabuyaro", "Castilla la Nueva", "Cubarral", 
    "El Calvario", "El Castillo", "El Dorado", "Fuente de Oro", "La Macarena", "Lejanías", "Mapiripán", "Puerto Concordia", "Puerto Lleras", "San Carlos de Guaroa", "San Juan de Arama", "Uribe"
  ],
  "Nariño": [
    "Pasto", "Ipiales", "Tumaco", "Túquerres", "La Unión", "Samaniego", "Barbacoas", "Sandoná", "Buesaco", 
    "Cumbal", "El Tambo", "San Pablo", "Aldana", "Ancuya", "Arboleda", "Belén", "Chachagüí", "Colón", 
    "Consaca", "Contadero", "Córdoba", "Cuaspud", "Cumbitara", "El Charco", "El Peñol", "El Rosario", 
    "El Tablón de Gómez", "Francisco Pizarro", "Funes", "Guachucal", "Guaitarilla", "Gualmatán", "Iles", "Imués", "La Cruz", "La Florida", "La Tola", "Leiva", "Linares", "Los Andes", "Magüí Payán", "Mallama", "Mosquera", "Nariño", "Olaya Herrera", "Ospina", "Paz Flandes", "Policarpa", "Puerres", "Pupiales", "Ricaurte", "Roberto Payán", "San Bernardo", "San Lorenzo", "San Pedro de Cartago", "Santa Bárbara", "Santacruz", "Sapuyes", "Taminango", "Tangua", "Yacuanquer"
  ],
  "Norte de Santander": [
    "Cúcuta", "Ocaña", "Villa del Rosario", "Los Patios", "Pamplona", "Tibú", "Chinácota", "Ábrego", 
    "Sardinata", "El Zulia", "Bochalema", "Arboledas", "Cachirá", "Cácota", "Chinácota", "Chitaga", "Convención", 
    "Cucutilla", "Durania", "El Carmen", "El Tarra", "Gramalote", "Hacarí", "Herrán", "La Esperanza", 
    "La Playa", "Labateca", "Lourdes", "Mutiscua", "Pamplonita", "Puerto Santander", "Ragonvalia", "Salazar", "San Calixto", "San Cayetano", "Santiago", "Silos", "Teorama", "Toledo"
  ],
  "Putumayo": [
    "Mocoa", "Puerto Asís", "Orito", "Sibundoy", "Valle del Guamuez (La Hormiga)", "Villagarzón", "Puerto Leguízamo", 
    "San Francisco", "Colón", "Puerto Caicedo", "Puerto Guzmán", "San Miguel", "Santiago"
  ],
  "Quindío": [
    "Armenia", "Calarcá", "La Tebaida", "Circasia", "Salento", "Montenegro", "Quimbaya", "Filandia", 
    "Génova", "Pijao", "Buenavista", "Córdoba"
  ],
  "Risaralda": [
    "Pereira", "Dosquebradas", "Santa Rosa de Cabal", "La Virginia", "Belén de Umbría", "Marsella", 
    "Quinchía", "Apía", "Santuario", "Guática", "Pueblo Rico", "Mistrató", "La Celia", "Balboa"
  ],
  "San Andrés y Providencia": [
    "San Andrés", "Providencia", "Santa Catalina"
  ],
  "Santander": [
    "Bucaramanga", "Floridablanca", "Girón", "Piedecuesta", "Barrancabermeja", "San Gil", "Socorro", 
    "Barbosa", "Vélez", "Zapatoca", "Lebrija", "Rionegro", "Sabana de Torres", "Cimitarra", "Málaga", 
    "Oiba", "Charalá", "Curití", "Aguada", "Aratoca", "Barichara", "Bolívar", "Capitanejo", "Carcasí", 
    "Cepitá", "Cerrito", "El Carmen de Chucurí", "El Guacamayo", "El Peñón", "El Playón", "Encino", "Enciso", 
    "Florián", "Gámbita", "Guaca", "Guadalupe", "Guapotá", "Guavatá", "Güepsa", "Hato", "Jesús María", "Jordán", 
    "La Belleza", "La Paz", "Landázuri", "Los Santos", "Macaravita", "Matanza", "Mogotes", "Molagavita", "Ocamonte", "Palmar", "Palmas del Socorro", "Páramo", "Puerto Wilches", "Puerto Parra", "San Andrés", "San Benito", "San Joaquín", "San José de Miranda", "San Miguel", "Santa Bárbara", "Santa Helena del Opón", "Simacota", "Suratá", "Tona", "Valle de San José"
  ],
  "Sucre": [
    "Sincelejo", "Corozal", "San Marcos", "Tolú", "Sampués", "Morroa", "San Onofre", "Majagual", 
    "Ovejas", "Sucre", "San Pedro", "Coveñas", "Buenavista", "Caimito", "Coloso", "El Roble", "Galeras", 
    "Guaranda", "La Unión", "Los Palmitos", "Palmito", "San Benito Abad", "San Juan de Betulia", "San Luis de Sincé", "Tolú Viejo"
  ],
  "Tolima": [
    "Ibagué", "Espinal", "Melgar", "Honda", "Mariquita", "Líbano", "Chaparral", "Purificación", 
    "Flandes", "Guamo", "Saldaña", "Natagaima", "Venadillo", "Fresno", "Armero Guayabal", "Rovira", 
    "Cajamarca", "Alpujarra", "Alvarado", "Ambalema", "Anzoátegui", "Ataco", "Canday", "Carmen de Apicalá", 
    "Casabianca", "Coello", "Coyaima", "Cunday", "Dolores", "Falan", "Herveo", "Icononzo", "Kiosko", "Ortega", "Palocabildo", "Piedras", "Planadas", "Prado", "Roncesvalles", "San Antonio", "San Luis", "Santa Isabel", "Suárez", "Valle de San Juan"
  ],
  "Valle del Cauca": [
    "Cali", "Palmira", "Buenaventura", "Tuluá", "Cartago", "Jamundí", "Yumbo", "Buga", "Sevilla", 
    "Zarzal", "Florida", "Pradera", "Candelaria", "Roldanillo", "La Unión", "Caicedonia", "Bugalagrande", 
    "Guacarí", "El Cerrito", "Dagua", "Ginebra", "Trujillo", "Restrepo", "Obando", "Alcalá", "Ansermanuevo", 
    "San Pedro", "Toro", "Andalucía", "Ansermanuevo", "Argelia", "Calima (El Darién)", "El Águila", "El Cairo", "El Dovio", "La Victoria", "Riofrío", "Ulloa", "Versalles", "Yotoco"
  ],
  "Vaupés": [
    "Mitú", "Carurú", "Taraira", "Papacaua", "Yavaraté", "Pacoa"
  ],
  "Vichada": [
    "Puerto Carreño", "La Primavera", "Santa Rosalía", "Cumaribo"
  ]
};

// Lista plana ordenada de todas las ciudades/municipios de Colombia para autocompletado rápido
export const TODAS_LAS_CIUDADES_COLOMBIA: { ciudad: string; departamento: string }[] = Object.entries(DEPARTAMENTOS_COLOMBIA).flatMap(
  ([depto, municipios]) => municipios.map(muni => ({ ciudad: `${muni}, ${depto}`, departamento: depto }))
).sort((a, b) => a.ciudad.localeCompare(b.ciudad));
