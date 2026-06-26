(function () {
	'use strict';

	const ALUMNOS_STORAGE_KEY = 'maletinPrimariaAlumnos';
	const PROFILE_STORAGE_KEY = 'maletinPrimariaTeacherProfile';
	const INCIDENTS_STORAGE_KEY = 'maletinPrimariaIncidentFeed';

	const builderOptions = {
		status: [
			{ value: 'destacado', label: 'Destacado' },
			{ value: 'proceso', label: 'En proceso' },
			{ value: 'apoyo', label: 'Requiere apoyo' }
		]
	};

	const statusInsights = {
		destacado: {
			strength: 'Muestra autonomia constante y buen ritmo de trabajo en clase.',
			focus: 'Potenciar su rol como apoyo entre pares para fortalecer al grupo.'
		},
		proceso: {
			strength: 'Avanza de forma sostenida cuando cuenta con instrucciones claras.',
			focus: 'Consolidar rutinas de cierre y retroalimentacion breve en cada sesion.'
		},
		apoyo: {
			strength: 'Responde mejor con acompanamiento cercano y consignas por pasos.',
			focus: 'Sostener seguimiento frecuente con acuerdos claros de asistencia y convivencia.'
		}
	};

	function parseJson(value, fallbackValue) {
		try {
			return JSON.parse(value);
		} catch (error) {
			return fallbackValue;
		}
	}

	function getCurrentIsoDate() {
		return new Date().toISOString().slice(0, 10);
	}

	function formatIncidentDate(isoDate) {
		const date = new Date(String(isoDate || '') + 'T00:00:00');
		if (Number.isNaN(date.getTime())) {
			return 'Sin fecha';
		}

		return date.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
	}

	function formatObservationDate(dateValue) {
		const date = new Date(String(dateValue || ''));
		if (Number.isNaN(date.getTime())) {
			return formatIncidentDate(dateValue);
		}

		return date.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }) + ' · '
			+ date.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
	}

	function normalizeObservationEntry(entry, index) {
		const safeEntry = entry && typeof entry === 'object' ? entry : {};
		const text = String(safeEntry.text || safeEntry.note || safeEntry.observation || '').trim();
		if (!text) {
			return null;
		}

		return {
			id: String(safeEntry.id || 'obs-' + index + '-' + Date.now()),
			text: text,
			createdAt: String(safeEntry.createdAt || safeEntry.date || safeEntry.fecha || new Date().toISOString())
		};
	}

	function normalizeIncidentPriority(value) {
		const priority = String(value || 'media').toLowerCase();
		if (priority === 'alta' || priority === 'media' || priority === 'baja') {
			return priority;
		}

		return 'media';
	}

	function incidentPriorityLabel(priority) {
		if (priority === 'alta') {
			return 'Alta';
		}

		if (priority === 'baja') {
			return 'Baja';
		}

		return 'Media';
	}

	function normalizeIncidentEntry(entry, index) {
		const safeEntry = entry && typeof entry === 'object' ? entry : {};
		const title = String(safeEntry.title || safeEntry.titulo || safeEntry.text || '').trim();
		const detail = String(safeEntry.detail || safeEntry.descripcion || safeEntry.note || 'Seguimiento requerido.').trim();
		const createdAt = String(safeEntry.createdAt || safeEntry.date || safeEntry.fecha || getCurrentIsoDate()).slice(0, 10);
		const rawObservations = Array.isArray(safeEntry.observations)
			? safeEntry.observations
			: Array.isArray(safeEntry.historial)
				? safeEntry.historial
				: [];
		const observations = rawObservations
			.map(function (obs, obsIndex) {
				return normalizeObservationEntry(obs, obsIndex);
			})
			.filter(Boolean);

		return {
			id: String(safeEntry.id || 'incident-' + index + '-' + Date.now()),
			title: title || 'Incidencia sin titulo',
			detail: detail,
			priority: normalizeIncidentPriority(safeEntry.priority),
			status: String(safeEntry.status || 'Abierta'),
			source: String(safeEntry.source || 'Observacion docente'),
			createdAt: createdAt,
			observations: observations
		};
	}

	function getDefaultIncidentEntries() {
		return alumnosMockData.alerts.map(function (text, index) {
			return normalizeIncidentEntry({
				id: 'seed-' + index,
				title: text,
				detail: 'Incidencia prioritaria registrada para seguimiento.',
				priority: index === 0 ? 'alta' : 'media',
				status: 'Abierta',
				source: 'Sistema',
				createdAt: getCurrentIsoDate()
			}, index);
		});
	}

	function loadIncidentEntries() {
		const stored = parseJson(window.localStorage.getItem(INCIDENTS_STORAGE_KEY), null);
		if (!Array.isArray(stored) || !stored.length) {
			return [];
		}

		return stored.map(function (entry, index) {
			return normalizeIncidentEntry(entry, index);
		});
	}

	function saveIncidentEntries(entries) {
		try {
			window.localStorage.setItem(INCIDENTS_STORAGE_KEY, JSON.stringify(Array.isArray(entries) ? entries : []));
		} catch (error) {
			return;
		}
	}

	function getTeacherProfile() {
		const rawProfile = window.localStorage.getItem(PROFILE_STORAGE_KEY);
		return rawProfile ? parseJson(rawProfile, {}) : {};
	}

	function resolveTeacherGradeLabel(profile) {
		const gradeCandidates = [
			profile && profile.level,
			profile && Array.isArray(profile.levels) && profile.levels[0],
			profile && profile.selectedGrado,
			profile && profile.grado,
			profile && profile.grade,
			profile && profile.group,
			profile && profile.grupo
		];

		for (let index = 0; index < gradeCandidates.length; index += 1) {
			const candidate = gradeCandidates[index];
			if (candidate === null || candidate === undefined || candidate === '') {
				continue;
			}

			if (typeof candidate === 'number') {
				const bounded = Math.min(6, Math.max(1, Math.floor(candidate)));
				return bounded + 'A';
			}

			const candidateText = String(candidate).toUpperCase().trim();
			const numberMatch = candidateText.match(/([1-6])/);
			if (!numberMatch) {
				continue;
			}

			const letterMatch = candidateText.match(/[A-F]/);
			return numberMatch[1] + (letterMatch ? letterMatch[0] : 'A');
		}

		return '3A';
	}

	function normalizeText(value) {
		return String(value || '')
			.normalize('NFD')
			.replace(/[\u0300-\u036f]/g, '')
			.toUpperCase();
	}

	function firstInternalVowel(word) {
		const cleanWord = normalizeText(word).replace(/[^A-Z]/g, '');
		for (let index = 1; index < cleanWord.length; index += 1) {
			if ('AEIOU'.indexOf(cleanWord[index]) >= 0) {
				return cleanWord[index];
			}
		}

		return 'X';
	}

	function firstInternalConsonant(word) {
		const cleanWord = normalizeText(word).replace(/[^A-Z]/g, '');
		for (let index = 1; index < cleanWord.length; index += 1) {
			if ('BCDFGHJKLMNPQRSTVWXYZ'.indexOf(cleanWord[index]) >= 0) {
				return cleanWord[index];
			}
		}

		return 'X';
	}

	function formatBirthDateLabel(dateText) {
		if (!dateText) {
			return 'Sin definir';
		}

		const date = new Date(dateText + 'T00:00:00');
		if (Number.isNaN(date.getTime())) {
			return 'Sin definir';
		}

		return date.toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });
	}

	function buildCurpByNameAndBirthDate(fullName, birthDate) {
		const cleanName = normalizeText(fullName).replace(/[^A-Z\s]/g, ' ').replace(/\s+/g, ' ').trim();
		const nameParts = cleanName.split(' ').filter(Boolean);
		const paternal = nameParts[0] || 'X';
		const maternal = nameParts[1] || 'X';
		const names = nameParts.slice(2).join(' ') || paternal;

		const date = new Date(String(birthDate || '') + 'T00:00:00');
		if (Number.isNaN(date.getTime())) {
			return null;
		}

		const yy = String(date.getFullYear()).slice(-2);
		const mm = String(date.getMonth() + 1).padStart(2, '0');
		const dd = String(date.getDate()).padStart(2, '0');

		const base = [
			normalizeText(paternal).charAt(0) || 'X',
			firstInternalVowel(paternal),
			normalizeText(maternal).charAt(0) || 'X',
			normalizeText(names).charAt(0) || 'X',
			yy + mm + dd,
			'X',
			'NE',
			firstInternalConsonant(paternal),
			firstInternalConsonant(maternal),
			firstInternalConsonant(names),
			'00'
		].join('');

		return base.slice(0, 18);
	}

	function loadStoredStudents() {
		try {
			const rawValue = window.localStorage.getItem(ALUMNOS_STORAGE_KEY);
			if (!rawValue) {
				return null;
			}

			const parsedValue = JSON.parse(rawValue);
			return Array.isArray(parsedValue) ? parsedValue : null;
		} catch (error) {
			return null;
		}
	}

	function cloneStudents(students) {
		return students.map(function (student) {
			return Object.assign({}, student, {
				tags: Array.isArray(student.tags) ? student.tags.slice() : []
			});
		});
	}

	function createEmptyBuilderState() {
		return {
			firstName: '',
			paternalLastName: '',
			maternalLastName: '',
			status: 'proceso',
			birthDate: ''
		};
	}

	function builderFullName() {
		return [state.builder.paternalLastName, state.builder.maternalLastName, state.builder.firstName]
			.map(function (part) { return part.trim(); })
			.filter(Boolean)
			.join(' ');
	}

	function builderDisplayName() {
		return [state.builder.firstName, state.builder.paternalLastName, state.builder.maternalLastName]
			.map(function (part) { return part.trim(); })
			.filter(Boolean)
			.join(' ');
	}

	const teacherProfile = getTeacherProfile();
	const teacherGradeLabel = resolveTeacherGradeLabel(teacherProfile);
	const GROUP_EXPERIENCE_STORAGE_KEY = 'maletinPrimariaGroupExperiences';
	const RESOURCE_METADATA_URL = 'src/metadata/resources.json';
	let resourceMetadataCache = null;
	let resourceMetadataPromise = null;

	const alumnosMockData = {
		classRoom: teacherGradeLabel + ' primaria',
		totalClasses: 40,
		completedClasses: 34,
		students: cloneStudents(loadStoredStudents() || []),
		attendanceGroups: [
			{ label: 'Grupo completo', value: 92 },
			{ label: 'Turno matutino', value: 94 },
			{ label: 'Alumnos con apoyo', value: 86 },
			{ label: 'Ultimos 5 dias', value: 91 }
		],
		progress: [
			{ label: 'Clases terminadas', current: 34, total: 40, detail: 'Ritmo estable en el bloque.' },
			{ label: 'Experiencias o proyectos NEM terminados', current: 9, total: 12, detail: 'Seguimiento real de experiencias del grupo.' },
			{ label: 'Asistencia promedio', current: 22, total: 28, detail: 'Promedio acumulado de asistencia por alumno.' }
		],
		alerts: [
			'Dos alumnos acumulan 3 faltas en la ultima quincena.',
			'Una incidencia de convivencia sigue abierta en recreo.',
			'Faltan evidencias de cierre en el equipo azul.',
			'Se detecta baja participacion en lectura guiada del jueves.'
		],
		actions: [
			{ title: 'Contactar a familias con inasistencia', detail: 'Priorizar a Emiliano y Diego antes del viernes.' },
			{ title: 'Ajustar equipos de trabajo', detail: 'Combinar perfiles destacados con alumnos en proceso.' },
			{ title: 'Cerrar rubricas pendientes', detail: 'Reservar 20 minutos al final de la clase 35.' }
		],
	};

	const state = {
		filter: 'all',
		query: '',
		selectedStudentId: alumnosMockData.students[0] ? alumnosMockData.students[0].id : null,
		openIncidentId: null,
		draftStudents: [],
		builder: createEmptyBuilderState()
	};

	function totalIncidents() {
		return alumnosMockData.students.reduce(function (sum, student) {
			return sum + Number(student.incidents || 0);
		}, 0);
	}

	function getTeacherGroupContext() {
		const phaseCandidates = [
			teacherProfile && teacherProfile.phase,
			teacherProfile && teacherProfile.fase,
			teacherProfile && teacherProfile.selectedPhase,
			teacherProfile && teacherProfile.cycle
		];

		let phase = 3;
		for (let index = 0; index < phaseCandidates.length; index += 1) {
			const candidate = phaseCandidates[index];
			if (candidate === null || candidate === undefined || candidate === '') {
				continue;
			}
			const parsed = parseInt(candidate, 10);
			if (Number.isFinite(parsed)) {
				phase = parsed;
				break;
			}
		}

		const gradeCandidates = [
			teacherProfile && teacherProfile.level,
			teacherProfile && Array.isArray(teacherProfile.levels) && teacherProfile.levels[0],
			teacherProfile && teacherProfile.selectedGrado,
			teacherProfile && teacherProfile.grado,
			teacherProfile && teacherProfile.grade,
			teacherProfile && teacherProfile.group,
			teacherProfile && teacherProfile.grupo
		];

		let grade = 1;
		let group = 'A';
		for (let index = 0; index < gradeCandidates.length; index += 1) {
			const candidate = gradeCandidates[index];
			if (candidate === null || candidate === undefined || candidate === '') {
				continue;
			}

			if (typeof candidate === 'number') {
				grade = Math.min(6, Math.max(1, Math.floor(candidate)));
				group = 'A';
				break;
			}

			const candidateText = String(candidate).toUpperCase().trim();
			const numberMatch = candidateText.match(/([1-6])/);
			if (!numberMatch) {
				continue;
			}

			grade = parseInt(numberMatch[1], 10) || 1;
			const letterMatch = candidateText.match(/[A-F]/);
			group = letterMatch ? letterMatch[0] : 'A';
			break;
		}

		const shiftCandidates = [teacherProfile && teacherProfile.shift, teacherProfile && teacherProfile.turno];
		let shift = '';
		for (let index = 0; index < shiftCandidates.length; index += 1) {
			const candidate = shiftCandidates[index];
			if (candidate !== null && candidate !== undefined && candidate !== '') {
				shift = String(candidate);
				break;
			}
		}

		return {
			phase: phase,
			grade: grade,
			group: String(group || 'A'),
			shift: shift
		};
	}

	function normalizeGroupKeyText(value) {
		return String(value || '')
			.trim()
			.toLowerCase()
			.replace(/\s+/g, '-')
			.replace(/[^a-z0-9\-]/g, '');
	}

	function getGroupExperienceKey() {
		const ctx = getTeacherGroupContext();
		return [
			'fase' + (ctx.phase || 'x'),
			'grado' + (ctx.grade || 'x'),
			'grupo' + (normalizeGroupKeyText(ctx.group) || 'a'),
			normalizeGroupKeyText(ctx.shift) || 'sin-turno'
		].join('_');
	}

	function getResourceFieldNames(resource) {
		const fields = resource && resource.contenido && Array.isArray(resource.contenido.campos_formativos)
			? resource.contenido.campos_formativos
			: [];

		return fields.map(function (field) {
			return field && field.campo ? String(field.campo).trim() : '';
		}).filter(Boolean);
	}

	function loadResourceMetadata() {
		if (Array.isArray(resourceMetadataCache)) {
			return Promise.resolve(resourceMetadataCache);
		}

		if (resourceMetadataPromise) {
			return resourceMetadataPromise;
		}

		resourceMetadataPromise = window.fetch(RESOURCE_METADATA_URL, { cache: 'no-store' })
			.then(function (response) {
				if (!response.ok) {
					throw new Error('No se pudo cargar la metadata de recursos.');
				}
				return response.json();
			})
			.then(function (data) {
				resourceMetadataCache = Array.isArray(data) ? data : [];
				return resourceMetadataCache;
			})
			.catch(function () {
				resourceMetadataCache = [];
				return resourceMetadataCache;
			});

		return resourceMetadataPromise;
	}

	function loadGroupExperienceSnapshots() {
		const rawStore = parseJson(window.localStorage.getItem(GROUP_EXPERIENCE_STORAGE_KEY), {});
		const groupKey = getGroupExperienceKey();
		const bucketKeys = rawStore && rawStore[groupKey] ? [groupKey] : Object.keys(rawStore || {});
		const snapshotsById = {};

		bucketKeys.forEach(function (key) {
			const bucket = rawStore && rawStore[key] ? rawStore[key] : null;
			const resources = bucket && bucket.resources && typeof bucket.resources === 'object' ? bucket.resources : {};
			Object.keys(resources).forEach(function (resourceId) {
				const snapshot = resources[resourceId] || {};
				const currentSnapshot = Object.assign({ resourceId: resourceId }, snapshot);
				const previousSnapshot = snapshotsById[resourceId];
				if (!previousSnapshot || Number(currentSnapshot.updatedAt || 0) >= Number(previousSnapshot.updatedAt || 0)) {
					snapshotsById[resourceId] = currentSnapshot;
				}
			});
		});

		return Object.keys(snapshotsById).map(function (resourceId) {
			return snapshotsById[resourceId];
		});
	}

	function buildFieldProgressCards(resources, snapshots) {
		const resourceMap = resources.reduce(function (accumulator, resource) {
			if (resource && resource.id) {
				accumulator[String(resource.id)] = resource;
			}
			return accumulator;
		}, {});

		const fieldMap = {};

		snapshots.forEach(function (snapshot) {
			const resource = resourceMap[String(snapshot.resourceId || snapshot.id || '')] || null;
			const fieldNames = getResourceFieldNames(resource);
			const progressValue = Math.max(0, Math.min(100, Number(snapshot.progress || 0)));
			const completed = snapshot.status === 'completado' || progressValue >= 100;
			const names = fieldNames.length ? fieldNames : ['Sin campo'];

			names.forEach(function (name) {
				if (!fieldMap[name]) {
					fieldMap[name] = {
						name: name,
						count: 0,
						completed: 0,
						progressSum: 0
					};
				}

				fieldMap[name].count += 1;
				fieldMap[name].completed += completed ? 1 : 0;
				fieldMap[name].progressSum += progressValue;
			});
		});

		return Object.keys(fieldMap)
			.sort(function (a, b) {
				const left = fieldMap[a];
				const right = fieldMap[b];
				return (right.progressSum / Math.max(1, right.count)) - (left.progressSum / Math.max(1, left.count));
			})
			.map(function (name) {
				const item = fieldMap[name];
				const averageProgress = Math.round(item.progressSum / Math.max(1, item.count));
				return {
					label: item.name,
					current: averageProgress,
					total: 100,
					detail: item.completed + '/' + item.count + ' experiencias terminadas'
				};
			});
	}

	function buildFieldProgressSummary(resources, snapshots) {
		const resourceMap = resources.reduce(function (accumulator, resource) {
			if (resource && resource.id) {
				accumulator[String(resource.id)] = resource;
			}
			return accumulator;
		}, {});

		const coveredFields = new Set();
		let totalProgress = 0;
		let completedExperiences = 0;

		snapshots.forEach(function (snapshot) {
			const resource = resourceMap[String(snapshot.resourceId || snapshot.id || '')] || null;
			const fieldNames = getResourceFieldNames(resource);
			const progressValue = Math.max(0, Math.min(100, Number(snapshot.progress || 0)));
			const completed = snapshot.status === 'completado' || progressValue >= 100;
			const names = fieldNames.length ? fieldNames : ['Sin campo'];

			names.forEach(function (name) {
				coveredFields.add(name);
			});
			totalProgress += progressValue;
			completedExperiences += completed ? 1 : 0;
		});

		return {
			fields: coveredFields.size,
			experiences: snapshots.length,
			completed: completedExperiences,
			averageProgress: snapshots.length ? Math.round(totalProgress / snapshots.length) : 0
		};
	}

	function renderFieldProgress() {
		const target = document.getElementById('alumnos-field-list');
		if (!target) {
			return;
		}

		target.innerHTML = '<p class="mb-0">Cargando avance por campo...</p>';

		loadResourceMetadata().then(function (resources) {
			const snapshots = loadGroupExperienceSnapshots();
			const items = buildFieldProgressCards(Array.isArray(resources) ? resources : [], snapshots);
			const summary = buildFieldProgressSummary(Array.isArray(resources) ? resources : [], snapshots);

			if (!items.length) {
				target.innerHTML = '<p class="mb-0">Aun no hay experiencias registradas para mostrar el avance por campo.</p>';
				return;
			}

			target.innerHTML = [
				'<div class="d-flex flex-wrap gap-2 mb-3">',
				'<span class="badge rounded-pill text-bg-light border text-dark">Campos cubiertos: ' + summary.fields + '</span>',
				'<span class="badge rounded-pill text-bg-light border text-dark">Experiencias registradas: ' + summary.experiences + '</span>',
				'<span class="badge rounded-pill text-bg-light border text-dark">Terminadas: ' + summary.completed + '</span>',
				'<span class="badge rounded-pill text-bg-light border text-dark">Avance promedio: ' + summary.averageProgress + '%</span>',
				'</div>',
				items.map(function (item) {
				return [
					'<div class="mb-3">',
					'<div class="d-flex justify-content-between align-items-center gap-2">',
					'<strong>' + item.label + '</strong>',
					'<span class="plano-meta mb-0">' + item.current + '%</span>',
					'</div>',
					'<div class="plano-progress-row mt-2">',
					'<div class="plano-progress-bar"><div class="plano-progress-fill" style="width: ' + item.current + '%"></div></div>',
					'<span class="plano-progress-pct">' + item.current + '%</span>',
					'</div>',
					'<p class="mb-0">' + item.detail + '</p>',
					'</div>'
				].join('');
				}).join(''),
			].join('');
		});
	}

	function getAssistantState() {
		const ASSISTANT_STATE_KEY = 'maletinAssistantStateV1';
		return parseJson(window.localStorage.getItem(ASSISTANT_STATE_KEY) || 'null', null);
	}

	function getAttendancePercent(student) {
		const log = student && student.attendanceLog && typeof student.attendanceLog === 'object'
			? student.attendanceLog
			: null;

		if (log) {
			const dates = Object.keys(log);
			if (dates.length) {
				const presents = dates.filter(function (date) {
					return log[date] === 'presente';
				}).length;
				return Math.round((presents / dates.length) * 100);
			}
		}

		const fallbackAttendance = Number(student && student.attendance);
		if (Number.isFinite(fallbackAttendance)) {
			return Math.max(0, Math.min(100, Math.round(fallbackAttendance)));
		}

		return null;
	}

	function getRecordedSessionsCount() {
		const uniqueDates = new Set();

		alumnosMockData.students.forEach(function (student) {
			const log = student && student.attendanceLog && typeof student.attendanceLog === 'object'
				? student.attendanceLog
				: null;
			if (!log) {
				return;
			}

			Object.keys(log).forEach(function (date) {
				uniqueDates.add(date);
			});
		});

		return uniqueDates.size;
	}

	function getNemExperienceTotals() {
		const experienceById = {};

		alumnosMockData.students.forEach(function (student) {
			const tracking = student && student.experienceTracking && typeof student.experienceTracking === 'object'
				? student.experienceTracking
				: null;
			if (!tracking) {
				return;
			}

			Object.keys(tracking).forEach(function (groupKey) {
				const group = tracking[groupKey] || {};
				const resources = group.resources && typeof group.resources === 'object' ? group.resources : {};

				Object.keys(resources).forEach(function (resourceId) {
					const snapshot = resources[resourceId] || {};
					experienceById[resourceId] = snapshot;
				});
			});
		});

		let total = Object.keys(experienceById).length;
		let completed = Object.keys(experienceById).filter(function (resourceId) {
			const snapshot = experienceById[resourceId] || {};
			const progress = Number(snapshot.progress || 0);
			return snapshot.status === 'completado' || progress >= 100;
		}).length;

		if (!total) {
			const assistantState = getAssistantState();
			const activeExperience = assistantState && assistantState.activeExperience;
			if (activeExperience) {
				total = 1;
				completed = Number(activeExperience.progress || 0) >= 100 ? 1 : 0;
			}
		}

		return { completed: completed, total: total };
	}

	function averageAttendance() {
		if (!alumnosMockData.students.length) {
			return 0;
		}

		const attendanceValues = alumnosMockData.students
			.map(function (student) { return getAttendancePercent(student); })
			.filter(function (value) { return value !== null; });

		if (!attendanceValues.length) {
			return 0;
		}

		const total = attendanceValues.reduce(function (sum, value) {
			return sum + value;
		}, 0);

		return Math.round(total / attendanceValues.length);
	}

	function buildProgressMetrics() {
		const assistantState = getAssistantState();
		const activeExperience = assistantState && assistantState.activeExperience;
		const recordedSessions = getRecordedSessionsCount();
		const completedClasses = recordedSessions || Number(alumnosMockData.completedClasses || 0);
		const totalClasses = Math.max(
			completedClasses,
			Number(activeExperience && activeExperience.totalSessions) || Number(alumnosMockData.totalClasses || 0) || completedClasses || 1
		);
		const attendanceAvg = averageAttendance();
		const nemExperiences = getNemExperienceTotals();

		return [
			{
				label: 'Clases terminadas',
				current: completedClasses,
				total: totalClasses,
				detail: recordedSessions
					? 'Calculado con sesiones registradas en la asistencia del grupo.'
					: 'Sin sesiones registradas aun; se usa el avance configurado del grupo.'
			},
			{
				label: 'Experiencias o proyectos NEM terminados',
				current: nemExperiences.completed,
				total: Math.max(nemExperiences.total, nemExperiences.completed, 1),
				detail: nemExperiences.total
					? 'Conteo real a partir del seguimiento de experiencias guardadas por grupo.'
					: 'Aun no hay experiencias NEM registradas para este grupo.'
			},
			{
				label: 'Asistencia promedio',
				current: attendanceAvg,
				total: 100,
				detail: 'Promedio real calculado con asistencia por alumno y sesiones registradas.'
			}
		];
	}

	function dashboardStats() {
		const support = alumnosMockData.students.filter((student) => student.status === 'apoyo').length;

		return [
			{ meta: alumnosMockData.classRoom, title: 'Cantidad de alumnos', value: alumnosMockData.students.length, detail: 'Grupo activo' },
			{ meta: 'Ultima semana', title: 'Asistencia promedio', value: averageAttendance() + '%', detail: 'Seguimiento diario' },
			{ meta: 'Casos abiertos', title: 'Incidencias', value: totalIncidents(), detail: 'Requieren revision' },
			{ meta: 'Seguimiento focal', title: 'Requieren apoyo', value: support, detail: 'Acompanamiento focalizado' }
		];
	}

	function renderHeroMetrics() {
		const target = document.getElementById('alumnos-hero-metrics');
		if (!target) {
			return;
		}

		target.innerHTML = [
			'<span><strong>' + alumnosMockData.students.length + '</strong> alumnos</span>',
			'<span><strong>' + averageAttendance() + '%</strong> asistencia promedio</span>',
			'<span><strong>' + totalIncidents() + '</strong> incidencias abiertas</span>'
		].join('');
	}

	function renderKpis() {
		const grid = document.getElementById('alumnos-kpi-grid');
		if (!grid) {
			return;
		}

		grid.innerHTML = dashboardStats().map((item) => {
			return [
				'<div class="col">',
				'<article class="plano-card h-100 p-3">',
				'<p class="plano-meta mb-1" style="font-size: 0.72rem;">' + item.meta + '</p>',
				'<h4 class="mb-1" style="font-size: 0.88rem; line-height: 1.2;">' + item.title + '</h4>',
				'<p class="fw-bold text-dark mb-1" style="font-size: 1.12rem; line-height: 1;">' + item.value + '</p>',
				'<p class="mb-0" style="font-size: 0.73rem; line-height: 1.25;">' + item.detail + '</p>',
				'</article>',
				'</div>'
			].join('');
		}).join('');
	}

	function renderAttendance() {
		const target = document.getElementById('alumnos-attendance-table');
		if (!target) {
			return;
		}

		target.innerHTML = alumnosMockData.attendanceGroups.map((group) => {
			return [
				'<div class="mb-3">',
				'<div class="d-flex justify-content-between align-items-center gap-2 mb-2">',
				'<span class="fw-bold text-dark">' + group.label + '</span>',
				'<span class="plano-meta mb-0">' + group.value + '%</span>',
				'</div>',
				'<div class="plano-progress-row mb-0">',
				'<div class="plano-progress-bar"><div class="plano-progress-fill" style="width: ' + group.value + '%"></div></div>',
				'<span class="plano-progress-pct">' + group.value + '%</span>',
				'</div>',
				'</div>'
			].join('');
		}).join('');
	}

	function renderProgress() {
		const target = document.getElementById('alumnos-progress-list');
		if (!target) {
			return;
		}

		const progressItems = buildProgressMetrics();

		target.innerHTML = progressItems.map((item) => {
			const safeTotal = Math.max(1, Number(item.total) || 1);
			const percent = Math.max(0, Math.min(100, Math.round((Number(item.current) / safeTotal) * 100)));
			return [
				'<div class="mb-3">',
				'<div class="d-flex justify-content-between align-items-center gap-2">',
				'<strong>' + item.label + '</strong>',
				'<span class="plano-meta mb-0">' + item.current + '/' + item.total + '</span>',
				'</div>',
				'<div class="plano-progress-row mt-2">',
				'<div class="plano-progress-bar"><div class="plano-progress-fill" style="width: ' + percent + '%"></div></div>',
				'<span class="plano-progress-pct">' + percent + '%</span>',
				'</div>',
				'<p class="mb-0">' + item.detail + '</p>',
				'</div>'
			].join('');
		}).join('');
	}

	function renderSimpleList(targetId, items, metaPrefix) {
		const target = document.getElementById(targetId);
		if (!target) {
			return;
		}

		target.innerHTML = items.map((item) => {
			return [
				'<div class="border-top pt-3 mt-3">',
				'<p class="plano-meta">' + metaPrefix + '</p>',
				'<strong class="d-block mb-1">' + item.title + '</strong>',
				'<p class="mb-0">' + item.detail + '</p>',
				'</div>'
			].join('');
		}).join('');
	}

	function renderBirthdays() {
		const target = document.getElementById('alumnos-birthday-list');
		if (!target) {
			return;
		}

		const birthdays = alumnosMockData.students.filter((student) => student.birthdayMonth);
		if (!birthdays.length) {
			target.innerHTML = '<p class="mb-0">Aun no hay cumpleanos registrados para mostrar.</p>';
			return;
		}

		target.innerHTML = birthdays.map((student) => {
			return [
				'<div class="border-top pt-3 mt-3">',
				'<p class="plano-meta">' + student.birthdayText + '</p>',
				'<strong class="d-block mb-1">' + student.name + '</strong>',
				'<p class="mb-0">' + student.grade + ' · oportunidad para fortalecer convivencia.</p>',
				'</div>'
			].join('');
		}).join('');
	}

	function syncBirthdayCardHeight() {
		const chartCards = [
			document.getElementById('seguimiento-asistencia'),
			document.getElementById('seguimiento-clases')
		].filter(Boolean);
		const birthdayCard = document.getElementById('cumpleanos');
		if (!chartCards.length || !birthdayCard) {
			return;
		}

		if (!window.matchMedia('(min-width: 992px)').matches) {
			birthdayCard.style.height = '';
			return;
		}

		birthdayCard.style.height = '';

		const chartHeight = Math.max.apply(null, chartCards.map(function (card) {
			return card.getBoundingClientRect().height;
		}));

		birthdayCard.style.height = chartHeight + 'px';
	}

	function renderAlerts() {
		const target = document.getElementById('alumnos-alert-list');
		const alertsCard = document.getElementById('alertas');
		if (!target) {
			return;
		}

		const incidents = loadIncidentEntries();
		if (!incidents.length) {
			target.innerHTML = '<p class="text-muted text-center py-3 mb-0">No hay incidencias registradas.</p>';
			if (alertsCard) {
				alertsCard.classList.remove('d-none');
			}
			return;
		}

		if (alertsCard) {
			alertsCard.classList.remove('d-none');
		}

		target.innerHTML = incidents.map(function (incident) {
			return [
				'<article class="incident-notification incident-priority-' + incident.priority + '">',
				'<div class="incident-notification-head">',
				'<span class="incident-chip is-' + incident.priority + '">' + incidentPriorityLabel(incident.priority) + '</span>',
				'<span class="incident-notification-actions">',
				'<button type="button" class="incident-open-btn" data-incident-open="' + incident.id + '">Abrir</button>',
				'<span class="incident-status">' + incident.status + '</span>',
				'<button type="button" class="incident-delete-btn" data-incident-delete="' + incident.id + '">Eliminar</button>',
				'</span>',
				'</div>',
				'<div class="incident-title">' + incident.title + '</div>',
				'<div class="incident-detail">' + incident.detail + '</div>',
				'<div class="incident-meta-row">',
				'<span class="incident-meta">' + formatIncidentDate(incident.createdAt) + '</span>',
				'<span class="incident-meta">' + incident.source + '</span>',
				'</div>',
				'</article>'
			].join('');
		}).join('');
	}

	function getIncidentById(incidentId) {
		const incidents = loadIncidentEntries();
		return incidents.find(function (incident) {
			return incident.id === incidentId;
		}) || null;
	}

	function getIncidentHistoryModal() {
		const modalElement = document.getElementById('alumnos-incident-history-modal');
		if (!modalElement || !window.bootstrap || !window.bootstrap.Modal) {
			return null;
		}

		return window.bootstrap.Modal.getOrCreateInstance(modalElement);
	}

	function renderIncidentHistoryModal() {
		const title = document.getElementById('alumnos-incident-history-title');
		const meta = document.getElementById('alumnos-incident-history-meta');
		const detailField = document.getElementById('incident-history-detail-input');
		const titleField = document.getElementById('incident-history-title-input');
		const priorityField = document.getElementById('incident-history-priority-input');
		const statusField = document.getElementById('incident-history-status-input');
		const sourceField = document.getElementById('incident-history-source-input');
		const list = document.getElementById('incident-history-list');
		const input = document.getElementById('incident-history-input');
		const closeIncidentBtn = document.getElementById('incident-history-close');

		if (!title || !meta || !list) {
			return;
		}

		const incident = state.openIncidentId ? getIncidentById(state.openIncidentId) : null;
		if (!incident) {
			title.textContent = 'Incidencia';
			meta.textContent = 'Sin datos';
			if (titleField) {
				titleField.value = '';
			}
			if (detailField) {
				detailField.value = '';
			}
			if (priorityField) {
				priorityField.value = 'media';
			}
			if (statusField) {
				statusField.value = 'Abierta';
			}
			if (sourceField) {
				sourceField.value = '';
			}
			list.innerHTML = '<p class="incident-observation-empty">Sin observaciones.</p>';
			if (input) {
				input.value = '';
			}
			if (closeIncidentBtn) {
				closeIncidentBtn.disabled = true;
				closeIncidentBtn.textContent = 'Cerrar incidencia';
			}
			return;
		}

		title.textContent = incident.title;
		meta.textContent = formatIncidentDate(incident.createdAt) + ' · ' + incident.source + ' · ' + incident.status;
		if (titleField) {
			titleField.value = incident.title;
		}
		if (detailField) {
			detailField.value = incident.detail;
		}
		if (priorityField) {
			priorityField.value = normalizeIncidentPriority(incident.priority);
		}
		if (statusField) {
			statusField.value = incident.status || 'Abierta';
		}
		if (sourceField) {
			sourceField.value = incident.source || 'Observacion docente';
		}

		const observations = (Array.isArray(incident.observations) ? incident.observations.slice() : []).sort(function (a, b) {
			return new Date(String(b.createdAt || '')).getTime() - new Date(String(a.createdAt || '')).getTime();
		});

		list.innerHTML = observations.length
			? observations.map(function (obs) {
				return [
					'<div class="incident-observation-item">',
					'<span class="incident-observation-date">' + formatObservationDate(obs.createdAt) + '</span>',
					'<span class="incident-observation-text">' + obs.text + '</span>',
					'<button type="button" class="incident-observation-delete" data-history-observation-delete="' + obs.id + '">×</button>',
					'</div>'
				].join('');
			}).join('')
			: '<p class="incident-observation-empty">Sin observaciones.</p>';

		if (input) {
			input.value = '';
		}

		if (closeIncidentBtn) {
			const statusNormalized = String(incident.status || '').toLowerCase();
			const alreadyClosed = statusNormalized === 'cerrada' || statusNormalized === 'completada';
			closeIncidentBtn.disabled = alreadyClosed;
			closeIncidentBtn.textContent = alreadyClosed ? 'Incidencia cerrada' : 'Cerrar incidencia';
		}
	}

	function openIncidentHistoryModal(incidentId) {
		state.openIncidentId = incidentId;
		renderIncidentHistoryModal();

		const modal = getIncidentHistoryModal();
		if (!modal) {
			return;
		}

		modal.show();
	}

	function filteredStudents() {
		const query = state.query.trim().toLowerCase();

		return alumnosMockData.students.filter((student) => {
			const matchesFilter = state.filter === 'all'
				|| (state.filter === 'cumpleanos' ? student.birthdayMonth : student.status === state.filter);
			const haystack = [student.name, student.strength, student.focus, student.curp || '', (student.tags || []).join(' ')].join(' ').toLowerCase();
			const matchesQuery = !query || haystack.indexOf(query) !== -1;
			return matchesFilter && matchesQuery;
		});
	}

	function ensureSelection(students) {
		if (!students.length) {
			state.selectedStudentId = null;
			return null;
		}

		const exists = students.some((student) => student.id === state.selectedStudentId);
		if (!exists) {
			state.selectedStudentId = students[0].id;
		}

		return students.find((student) => student.id === state.selectedStudentId) || students[0];
	}

	function renderDetailStatusChips(currentStatus) {
		return builderOptions.status.map(function (opt) {
			const active = currentStatus === opt.value ? ' is-active' : '';
			return '<button type="button" class="planos-builder-chip' + active + '" data-detail-status="' + opt.value + '">' + opt.label + '</button>';
		}).join('');
	}

	function openStudentDetailPanel(studentId) {
		const student = alumnosMockData.students.find(function (s) { return s.id === studentId; });
		if (!student) {
			return;
		}

		const title = document.getElementById('alumnos-detalle-offcanvas-title');
		const eyebrow = document.getElementById('alumnos-detalle-eyebrow');
		const body = document.getElementById('alumnos-detalle-body');
		if (!title || !body) {
			return;
		}

		title.textContent = student.name;
		if (eyebrow) {
			eyebrow.textContent = student.grade + ' · Perfil del alumno';
		}

		// Fallback: split stored full name if individual fields are missing
		let fn = student.firstName || '';
		let pa = student.paternalLastName || '';
		let ma = student.maternalLastName || '';
		if (!fn && !pa && student.name) {
			const parts = student.name.trim().split(/\s+/);
			fn = parts[0] || '';
			pa = parts[1] || '';
			ma = parts[2] || '';
		}
		const bd = student.birthDate || '';

		body.innerHTML = [
			'<form id="alumnos-detalle-form" data-student-id="' + student.id + '" novalidate>',

			'<div class="plano-card p-3 mb-3">',
			'<p class="planos-builder-label mb-2">Datos del alumno</p>',
			'<div class="row g-2">',
			'<div class="col-12">',
			'<label class="form-label mb-1" for="detalle-firstname">Nombre(s)</label>',
			'<input class="form-control" id="detalle-firstname" name="firstName" type="text" value="' + fn + '">',
			'</div>',
			'<div class="col-6">',
			'<label class="form-label mb-1" for="detalle-paternal">Ap. paterno</label>',
			'<input class="form-control" id="detalle-paternal" name="paternalLastName" type="text" value="' + pa + '">',
			'</div>',
			'<div class="col-6">',
			'<label class="form-label mb-1" for="detalle-maternal">Ap. materno</label>',
			'<input class="form-control" id="detalle-maternal" name="maternalLastName" type="text" value="' + ma + '">',
			'</div>',
			'<div class="col-12">',
			'<label class="form-label mb-1" for="detalle-birthdate">Fecha de nacimiento</label>',
			'<input class="form-control" id="detalle-birthdate" name="birthDate" type="date" value="' + bd + '">',
			'</div>',
			'</div>',
			'</div>',

			'<div class="plano-card p-3 mb-3">',
			'<p class="planos-builder-label mb-2">Nivel de acompanamiento</p>',
			'<div class="planos-builder-chip-group" id="detalle-status-chips">',
			renderDetailStatusChips(student.status),
			'</div>',
			'<input type="hidden" id="detalle-status-value" name="status" value="' + student.status + '">',
			'</div>',

			'<div class="plano-card p-3 mb-3">',
			'<p class="planos-builder-label mb-1">CURP calculado</p>',
			'<p class="mb-0 text-dark" id="detalle-curp-display" style="font-size:0.82rem;word-break:break-all;font-family:monospace;">' + (student.curp || 'Pendiente') + '</p>',
			'</div>',

			'<div class="d-flex flex-column gap-2">',
			'<button type="submit" class="btn beta-primary-btn w-100">Guardar cambios</button>',
			'<button type="button" class="btn btn-outline-danger w-100" id="detalle-baja-btn" data-student-id="' + student.id + '">Dar de baja del curso</button>',
			'</div>',

			'</form>'
		].join('');

		const offcanvasEl = document.getElementById('alumnos-detalle-offcanvas');
		if (offcanvasEl && window.bootstrap && window.bootstrap.Modal) {
			window.bootstrap.Modal.getOrCreateInstance(offcanvasEl).show();
		}
	}

	function renderStudentDetail(student) {
		const name = document.getElementById('alumnos-detail-name');
		const summary = document.getElementById('alumnos-detail-summary');
		const tags = document.getElementById('alumnos-detail-tags');
		const strength = document.getElementById('alumnos-detail-strength');
		const focus = document.getElementById('alumnos-detail-focus');

		if (!name || !summary || !tags || !strength || !focus) {
			return;
		}

		if (!student) {
			name.textContent = 'Sin resultados';
			summary.textContent = 'No hay alumnos que coincidan con la busqueda actual.';
			tags.innerHTML = '';
			strength.textContent = 'Ajusta la busqueda o el filtro.';
			focus.textContent = 'No hay detalle disponible con la seleccion actual.';
			return;
		}

		name.textContent = student.name;
		const attendanceSummary = student.attendance === null || student.attendance === undefined ? 'Sin datos de asistencia' : student.attendance + '% asistencia';
		summary.textContent = student.grade + ' · ' + attendanceSummary + ' · ' + (student.incidents || 0) + ' incidencias · nacimiento ' + student.birthdayText + ' · CURP ' + (student.curp || 'pendiente') + '.';
		tags.innerHTML = '<span>' + student.status + '</span>';
		strength.textContent = student.strength;
		focus.textContent = student.focus;
	}

	function renderStudentTable() {
		const body = document.getElementById('alumnos-table-body');
		const count = document.getElementById('alumnos-table-count');
		if (!body || !count) {
			return;
		}

		const students = filteredStudents();
		count.textContent = students.length + ' alumnos';

		if (!students.length) {
			body.innerHTML = '<tr><td colspan="7" class="text-center py-4"><div class="d-flex flex-column align-items-center gap-2"><strong class="text-dark">Aun no tienes alumnos registrados</strong><span class="small text-muted">Inicia con una alta rapida y el tablero se completa solo.</span><button type="button" class="btn beta-primary-btn px-3 py-2" data-open-add-student="true">Agregar primer alumno</button></div></td></tr>';
			return;
		}

		body.innerHTML = students.map((student) => {
			const statusClass = student.status === 'destacado'
				? 'is-success'
				: student.status === 'apoyo'
					? 'is-warning'
					: 'is-info';
			const incidentsText = !student.incidents ? 'Sin incidencias' : student.incidents + ' abiertas';
			const attendanceText = student.attendance === null || student.attendance === undefined ? 'Sin datos' : student.attendance + '%';
			return [
				'<tr data-student-id="' + student.id + '">',
				'<td>',
				'<div class="d-flex flex-column gap-1">',
				'<strong class="text-dark">' + student.name + '</strong>',
				'<span class="small text-muted">CURP: ' + (student.curp || 'pendiente') + '</span>',
				'</div>',
				'</td>',
				'<td><span class="plano-meta mb-0">' + student.grade + '</span></td>',
				'<td><span class="planos-table-pill">' + attendanceText + '</span></td>',
				'<td><span class="small ' + (student.incidents ? 'text-warning' : 'text-muted') + '">' + incidentsText + '</span></td>',
				'<td><span class="planos-status-badge ' + statusClass + '">' + student.status + '</span></td>',
				'<td><span class="small text-muted">' + student.birthdayText + '</span></td>',
				'<td class="text-end"><a href="#alumnos-detalle-card" class="planos-link" data-student-link="' + student.id + '">Ver detalle</a></td>',
				'</tr>'
			].join('');
		}).join('');
	}

	function persistStudents() {
		try {
			window.localStorage.setItem(ALUMNOS_STORAGE_KEY, JSON.stringify(alumnosMockData.students));
		} catch (error) {
			return;
		}
	}

	function incidentsFromStatus(status) {
		if (status === 'apoyo') {
			return 2;
		}

		if (status === 'proceso') {
			return 1;
		}

		return 0;
	}

	function slugify(value) {
		return String(value || '')
			.toLowerCase()
			.normalize('NFD')
			.replace(/[\u0300-\u036f]/g, '')
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/(^-|-$)/g, '');
	}

	function createStudentFromBuilder() {
		const fullName = builderFullName();
		const displayName = builderDisplayName();
		if (!state.builder.firstName.trim() || !state.builder.paternalLastName.trim() || !state.builder.birthDate) {
			return null;
		}

		const statusConfig = statusInsights[state.builder.status] || statusInsights.proceso;
		const curp = buildCurpByNameAndBirthDate(fullName, state.builder.birthDate);
		const birthDate = new Date(state.builder.birthDate + 'T00:00:00');
		const birthdayMonth = !Number.isNaN(birthDate.getTime()) && birthDate.getMonth() === new Date().getMonth();

		return {
			id: slugify(displayName) + '-' + Date.now(),
			name: displayName,
			firstName: state.builder.firstName.trim(),
			paternalLastName: state.builder.paternalLastName.trim(),
			maternalLastName: state.builder.maternalLastName.trim(),
			grade: teacherGradeLabel,
			attendance: null,
			status: state.builder.status,
			birthdayMonth: birthdayMonth,
			birthDate: state.builder.birthDate,
			birthdayText: formatBirthDateLabel(state.builder.birthDate),
			incidents: 0,
			strength: statusConfig.strength,
			focus: statusConfig.focus,
			tags: [],
			curp: curp || 'PENDIENTE'
		};
	}

	function builderSelections() {
		return [
			{ key: 'status', targetId: 'alumnos-builder-statuses', options: builderOptions.status }
		];
	}

	function renderBuilderControls() {
		builderSelections().forEach(function (group) {
			const target = document.getElementById(group.targetId);
			if (!target) {
				return;
			}

			target.innerHTML = group.options.map(function (option) {
				const activeClass = state.builder[group.key] === option.value ? ' is-active' : '';
				return '<button type="button" class="planos-builder-chip' + activeClass + '" data-builder-key="' + group.key + '" data-builder-value="' + option.value + '">' + option.label + '</button>';
			}).join('');
		});
	}

	function renderDraftStudents() {
		const list = document.getElementById('alumnos-builder-list');
		const count = document.getElementById('alumnos-builder-draft-count');
		if (!list || !count) {
			return;
		}

		count.textContent = state.draftStudents.length + ' alumnos';

		if (!state.draftStudents.length) {
			list.innerHTML = '<div class="planos-builder-empty">Cada alta que armes se apila aqui para registrar varios alumnos en un solo paso.</div>';
			return;
		}

		list.innerHTML = state.draftStudents.map(function (student, index) {
			return [
				'<article class="planos-builder-draft-item">',
				'<div>',
				'<strong class="d-block">' + student.name + '</strong>',
				'<span class="small text-muted">' + student.grade + ' · ' + student.status + ' · ' + student.birthdayText + ' · CURP ' + student.curp + '</span>',
				'</div>',
				'<button type="button" class="planos-builder-remove" data-draft-index="' + index + '" aria-label="Quitar alumno">×</button>',
				'</article>'
			].join('');
		}).join('');
	}

	function resetBuilder(keepDrafts) {
		state.builder = createEmptyBuilderState();
		if (!keepDrafts) {
			state.draftStudents = [];
		}

		['alumnos-builder-firstname', 'alumnos-builder-paternal', 'alumnos-builder-maternal'].forEach(function (fieldId) {
			const field = document.getElementById(fieldId);
			if (field) {
				field.value = '';
			}
		});

		const birthInput = document.getElementById('alumnos-builder-birthdate');
		if (birthInput) {
			birthInput.value = '';
		}

		renderBuilderControls();
		renderDraftStudents();
	}

	function getAddStudentModal() {
		const modalElement = document.getElementById('alumnos-create-modal');
		if (!modalElement || !window.bootstrap || !window.bootstrap.Modal) {
			return null;
		}

		return window.bootstrap.Modal.getOrCreateInstance(modalElement);
	}

	function openAddStudentModal() {
		const modal = getAddStudentModal();
		if (!modal) {
			return;
		}

		resetBuilder(false);
		modal.show();
	}

	function registerDraftStudents() {
		if (!state.draftStudents.length) {
			return;
		}

		alumnosMockData.students = alumnosMockData.students.concat(state.draftStudents);
		state.selectedStudentId = alumnosMockData.students[0] ? alumnosMockData.students[0].id : null;
		persistStudents();
		refreshDashboard();
		state.draftStudents = [];
		resetBuilder(false);

		const modal = getAddStudentModal();
		if (modal) {
			modal.hide();
		}
	}

	function refreshDashboard() {
		renderHeroMetrics();
		renderKpis();
		renderBirthdays();
		renderStudentGrid();
		renderStudentTable();
	}

	function renderStudentGrid() {
		const target = document.getElementById('alumnos-student-grid');
		if (!target) {
			return;
		}

		const students = filteredStudents();
		const selected = ensureSelection(students);

		if (!students.length) {
			target.innerHTML = '<div class="col-12"><article class="plano-card"><p class="mb-0">No hay alumnos que coincidan con la busqueda actual.</p></article></div>';
			renderStudentDetail(null);
			return;
		}

		target.innerHTML = students.map((student) => {
			return [
				'<div class="col-12 col-md-6 col-xl-4">',
				'<article class="plano-card h-100" data-student-id="' + student.id + '">',
				'<p class="plano-meta">' + student.grade + ' · ' + student.status + '</p>',
				'<h4>' + student.name + '</h4>',
				'<p>' + (student.attendance === null || student.attendance === undefined ? 'Sin asistencia registrada' : student.attendance + '% asistencia') + ' · ' + (student.incidents || 0) + ' incidencias.</p>',
				'<p class="small text-muted mb-2">Nacimiento: ' + student.birthdayText + '</p>',
				'<p class="small text-muted mb-3">CURP: ' + (student.curp || 'pendiente') + '</p>',
				'<a href="#alumnos-detalle-card" class="planos-link" data-student-link="' + student.id + '">Ver detalle →</a>',
				'</article>',
				'</div>'
			].join('');
		}).join('');

		renderStudentDetail(selected);
	}

	function syncActiveChip() {
		Array.from(document.querySelectorAll('.planos-chip')).forEach((chip) => {
			chip.classList.toggle('is-active', chip.getAttribute('data-filter') === state.filter);
		});
	}

	function getAddIncidentModal() {
		const modalElement = document.getElementById('alumnos-incident-modal');
		if (!modalElement || !window.bootstrap || !window.bootstrap.Modal) {
			return null;
		}

		return window.bootstrap.Modal.getOrCreateInstance(modalElement);
	}

	function openAddIncidentModal() {
		const modal = getAddIncidentModal();
		if (!modal) {
			return;
		}

		const form = document.getElementById('alumnos-incident-form');
		if (form) {
			form.reset();
		}

		const priorityField = document.getElementById('incident-priority');
		const statusField = document.getElementById('incident-status');
		const sourceField = document.getElementById('incident-source');
		if (priorityField) priorityField.value = 'media';
		if (statusField) statusField.value = 'Abierta';
		if (sourceField) sourceField.value = 'Observacion docente';

		modal.show();
	}

	function bindEvents() {
		const search = document.getElementById('alumnos-search');
		const addTrigger = document.getElementById('alumnos-add-trigger');
		const addIncidentTrigger = document.getElementById('alumnos-add-incident-trigger');
		const builderBirthDate = document.getElementById('alumnos-builder-birthdate');
		const builderAdd = document.getElementById('alumnos-builder-add');
		const builderSave = document.getElementById('alumnos-builder-save');
		const builderModal = document.getElementById('alumnos-create-modal');

		if (addTrigger) {
			addTrigger.addEventListener('click', openAddStudentModal);
		}

		const printTrigger = document.getElementById('alumnos-print-trigger');
		if (printTrigger) {
			printTrigger.addEventListener('click', printStudentList);
		}

		const asistenciaTrigger = document.getElementById('alumnos-asistencia-trigger');
		if (asistenciaTrigger) {
			asistenciaTrigger.addEventListener('click', renderAttendanceModal);
		}

		const asistenciaSave = document.getElementById('alumnos-asistencia-save');
		if (asistenciaSave) {
			asistenciaSave.addEventListener('click', saveAttendance);
		}

		if (addIncidentTrigger) {
			addIncidentTrigger.addEventListener('click', openAddIncidentModal);
		}

		const historyTrigger = document.getElementById('alumnos-history-trigger');
		if (historyTrigger) {
			historyTrigger.addEventListener('click', printAttendanceHistory);
		}

		const actividadesTrigger = document.getElementById('alumnos-actividades-trigger');
		if (actividadesTrigger) {
			actividadesTrigger.addEventListener('click', printActivitiesReport);
		}

		if (search) {
			search.addEventListener('input', function (event) {
				state.query = event.target.value;
				renderStudentGrid();
				renderStudentTable();
			});
		}

		Array.from(document.querySelectorAll('.planos-chip')).forEach((chip) => {
			chip.addEventListener('click', function () {
				state.filter = chip.getAttribute('data-filter') || 'all';
				syncActiveChip();
				renderStudentGrid();
				renderStudentTable();
			});
		});

		const grid = document.getElementById('alumnos-student-grid');
		if (grid) {
			grid.addEventListener('click', function (event) {
				const trigger = event.target.closest('[data-student-id], [data-student-link]');
				if (!trigger) {
					return;
				}

				const studentId = trigger.getAttribute('data-student-id') || trigger.getAttribute('data-student-link');
				state.selectedStudentId = studentId;
				renderStudentGrid();
				renderStudentTable();
			});
		}

		const incidentForm = document.getElementById('alumnos-incident-form');
		if (incidentForm) {
			incidentForm.addEventListener('submit', function (event) {
				event.preventDefault();

				const titleField = document.getElementById('incident-title');
				const detailField = document.getElementById('incident-detail');
				const priorityField = document.getElementById('incident-priority');
				const statusField = document.getElementById('incident-status');
				const sourceField = document.getElementById('incident-source');

				const title = titleField ? titleField.value.trim() : '';
				const detail = detailField ? detailField.value.trim() : '';
				if (!title || !detail) {
					return;
				}

				const incidents = loadIncidentEntries();
				incidents.unshift(normalizeIncidentEntry({
					id: 'incident-' + Date.now(),
					title: title,
					detail: detail,
					priority: priorityField ? priorityField.value : 'media',
					status: statusField ? statusField.value : 'Abierta',
					source: sourceField ? sourceField.value.trim() : 'Observacion docente',
					createdAt: getCurrentIsoDate()
				}, 0));
				saveIncidentEntries(incidents);
				renderAlerts();

				const modalEl = document.getElementById('alumnos-incident-modal');
				if (modalEl && window.bootstrap && window.bootstrap.Modal) {
					window.bootstrap.Modal.getOrCreateInstance(modalEl).hide();
				}

				incidentForm.reset();
				if (priorityField) priorityField.value = 'media';
				if (statusField) statusField.value = 'Abierta';
				if (sourceField) sourceField.value = 'Observacion docente';
			});
		}

		const historyForm = document.getElementById('alumnos-incident-history-form');
		if (historyForm) {
			historyForm.addEventListener('submit', function (event) {
				event.preventDefault();
				if (!state.openIncidentId) {
					return;
				}

				const titleField = document.getElementById('incident-history-title-input');
				const detailField = document.getElementById('incident-history-detail-input');
				const priorityField = document.getElementById('incident-history-priority-input');
				const statusField = document.getElementById('incident-history-status-input');
				const sourceField = document.getElementById('incident-history-source-input');

				const title = titleField ? titleField.value.trim() : '';
				const detail = detailField ? detailField.value.trim() : '';
				if (!title || !detail) {
					return;
				}

				const incidents = loadIncidentEntries().map(function (incident) {
					if (incident.id !== state.openIncidentId) {
						return incident;
					}

					incident.title = title;
					incident.detail = detail;
					incident.priority = normalizeIncidentPriority(priorityField ? priorityField.value : incident.priority);
					incident.status = statusField ? String(statusField.value || 'Abierta') : incident.status;
					incident.source = sourceField ? String(sourceField.value || '').trim() || 'Observacion docente' : incident.source;
					return incident;
				});

				saveIncidentEntries(incidents);
				renderAlerts();
				renderIncidentHistoryModal();
			});
		}

		const alertList = document.getElementById('alumnos-alert-list');
		if (alertList) {
			alertList.addEventListener('click', function (event) {
				const openIncidentTrigger = event.target.closest('[data-incident-open]');
				if (openIncidentTrigger) {
					const incidentId = openIncidentTrigger.getAttribute('data-incident-open');
					openIncidentHistoryModal(incidentId);
					return;
				}

				const deleteTrigger = event.target.closest('[data-incident-delete]');
				if (!deleteTrigger) {
					return;
				}

				const incidentId = deleteTrigger.getAttribute('data-incident-delete');
				const incidents = loadIncidentEntries().filter(function (incident) {
					return incident.id !== incidentId;
				});
				if (state.openIncidentId === incidentId) {
					state.openIncidentId = null;
					const historyModal = getIncidentHistoryModal();
					if (historyModal) {
						historyModal.hide();
					}
				}
				saveIncidentEntries(incidents);
				renderAlerts();
			});
		}

		const historyAdd = document.getElementById('incident-history-add');
		const historyInput = document.getElementById('incident-history-input');
		const historyList = document.getElementById('incident-history-list');
		const historyClose = document.getElementById('incident-history-close');
		if (historyAdd && historyInput) {
			historyAdd.addEventListener('click', function () {
				const incidentId = state.openIncidentId;
				if (!incidentId) {
					return;
				}
				const observationText = historyInput.value.trim();
				if (!observationText) {
					return;
				}

				const incidents = loadIncidentEntries().map(function (incident) {
					if (incident.id !== incidentId) {
						return incident;
					}

					const observations = Array.isArray(incident.observations) ? incident.observations.slice() : [];
					observations.unshift(normalizeObservationEntry({
						id: 'obs-' + Date.now(),
						text: observationText,
						createdAt: new Date().toISOString()
					}, 0));
					incident.observations = observations.filter(Boolean);
					return incident;
				});

				saveIncidentEntries(incidents);
				renderAlerts();
				renderIncidentHistoryModal();
			});

			historyInput.addEventListener('keydown', function (event) {
				if (event.key === 'Enter') {
					event.preventDefault();
					historyAdd.click();
				}
			});
		}

		if (historyList) {
			historyList.addEventListener('click', function (event) {
				const deleteTrigger = event.target.closest('[data-history-observation-delete]');
				if (!deleteTrigger || !state.openIncidentId) {
					return;
				}

				const observationId = deleteTrigger.getAttribute('data-history-observation-delete');
				const incidents = loadIncidentEntries().map(function (incident) {
					if (incident.id !== state.openIncidentId) {
						return incident;
					}

					incident.observations = (Array.isArray(incident.observations) ? incident.observations : []).filter(function (obs) {
						return obs.id !== observationId;
					});
					return incident;
				});

				saveIncidentEntries(incidents);
				renderAlerts();
				renderIncidentHistoryModal();
			});
		}

		if (historyClose) {
			historyClose.addEventListener('click', function () {
				if (!state.openIncidentId) {
					return;
				}

				const incidents = loadIncidentEntries().map(function (incident) {
					if (incident.id !== state.openIncidentId) {
						return incident;
					}

					incident.status = 'Cerrada';
					return incident;
				});

				saveIncidentEntries(incidents);
				renderAlerts();
				renderIncidentHistoryModal();
			});
		}

		const historyModalEl = document.getElementById('alumnos-incident-history-modal');
		if (historyModalEl) {
			historyModalEl.addEventListener('hidden.bs.modal', function () {
				state.openIncidentId = null;
			});
		}

		const table = document.getElementById('alumnos-table-body');
		if (table) {
			table.addEventListener('click', function (event) {
				const openModalTrigger = event.target.closest('[data-open-add-student]');
				if (openModalTrigger) {
					openAddStudentModal();
					return;
				}

				const detailLink = event.target.closest('[data-student-link]');
				if (detailLink) {
					event.preventDefault();
					openStudentDetailPanel(detailLink.getAttribute('data-student-link'));
					return;
				}

				const trigger = event.target.closest('[data-student-id]');
				if (!trigger) {
					return;
				}

				const studentId = trigger.getAttribute('data-student-id');
				state.selectedStudentId = studentId;
				renderStudentGrid();
				renderStudentTable();
			});
		}

		[['alumnos-builder-firstname', 'firstName'], ['alumnos-builder-paternal', 'paternalLastName'], ['alumnos-builder-maternal', 'maternalLastName']].forEach(function (pair) {
			const field = document.getElementById(pair[0]);
			if (field) {
				field.addEventListener('input', function (event) {
					state.builder[pair[1]] = event.target.value;
				});
			}
		});

		if (builderBirthDate) {
			builderBirthDate.addEventListener('change', function (event) {
				state.builder.birthDate = event.target.value;
			});
		}

		if (builderModal) {
			builderModal.addEventListener('click', function (event) {
				const builderChip = event.target.closest('[data-builder-key][data-builder-value]');
				const removeDraft = event.target.closest('[data-draft-index]');
				if (builderChip) {
					state.builder[builderChip.getAttribute('data-builder-key')] = builderChip.getAttribute('data-builder-value');
					renderBuilderControls();
					return;
				}

				if (removeDraft) {
					state.draftStudents.splice(Number(removeDraft.getAttribute('data-draft-index')), 1);
					renderDraftStudents();
				}
			});

			builderModal.addEventListener('hidden.bs.modal', function () {
				resetBuilder(false);
			});
		}

		if (builderAdd) {
			builderAdd.addEventListener('click', function () {
				const newStudent = createStudentFromBuilder();
				if (!newStudent) {
					const firstNameInput = document.getElementById('alumnos-builder-firstname');
					const paternalInput = document.getElementById('alumnos-builder-paternal');
					const birthInput = document.getElementById('alumnos-builder-birthdate');
					if (firstNameInput && !firstNameInput.value.trim()) {
						firstNameInput.focus();
					} else if (paternalInput && !paternalInput.value.trim()) {
						paternalInput.focus();
					} else if (birthInput && !birthInput.value) {
						birthInput.focus();
					}
					return;
				}

				state.draftStudents.push(newStudent);
				resetBuilder(true);
			});
		}

		if (builderSave) {
			builderSave.addEventListener('click', registerDraftStudents);
		}

		const detailOffcanvas = document.getElementById('alumnos-detalle-offcanvas');
		if (detailOffcanvas) {
			detailOffcanvas.addEventListener('click', function (event) {
				const statusChip = event.target.closest('[data-detail-status]');
				if (statusChip) {
					const newStatus = statusChip.getAttribute('data-detail-status');
					const chipsContainer = document.getElementById('detalle-status-chips');
					const hiddenInput = document.getElementById('detalle-status-value');
					if (chipsContainer) {
						Array.from(chipsContainer.querySelectorAll('[data-detail-status]')).forEach(function (btn) {
							btn.classList.toggle('is-active', btn.getAttribute('data-detail-status') === newStatus);
						});
					}
					if (hiddenInput) {
						hiddenInput.value = newStatus;
					}
					return;
				}

				const bajaBtn = event.target.closest('#detalle-baja-btn');
				if (bajaBtn) {
					const studentId = bajaBtn.getAttribute('data-student-id');
					if (!window.confirm('¿Dar de baja a este alumno del curso? Esta accion no se puede deshacer.')) {
						return;
					}
					alumnosMockData.students = alumnosMockData.students.filter(function (s) { return s.id !== studentId; });
					persistStudents();
					refreshDashboard();
					const offcanvasEl = document.getElementById('alumnos-detalle-offcanvas');
					if (offcanvasEl && window.bootstrap && window.bootstrap.Modal) {
						window.bootstrap.Modal.getInstance(offcanvasEl).hide();
					}
					return;
				}
			});

			detailOffcanvas.addEventListener('input', function (event) {
				const field = event.target.closest('#detalle-firstname, #detalle-paternal, #detalle-maternal, #detalle-birthdate');
				if (!field) { return; }
				const fn = (document.getElementById('detalle-firstname') || {}).value || '';
				const pa = (document.getElementById('detalle-paternal') || {}).value || '';
				const ma = (document.getElementById('detalle-maternal') || {}).value || '';
				const bd = (document.getElementById('detalle-birthdate') || {}).value || '';
				const fullNameCurp = [pa, ma, fn].filter(Boolean).join(' ');
				const curpDisplay = document.getElementById('detalle-curp-display');
				if (curpDisplay) {
					curpDisplay.textContent = fullNameCurp && bd
						? (buildCurpByNameAndBirthDate(fullNameCurp, bd) || 'Pendiente')
						: 'Pendiente';
				}
				const titleEl = document.getElementById('alumnos-detalle-offcanvas-title');
				const displayName = [fn, pa, ma].filter(Boolean).join(' ');
				if (titleEl && displayName) {
					titleEl.textContent = displayName;
				}
			});

			const detailForm = detailOffcanvas;
			detailOffcanvas.addEventListener('submit', function (event) {
				const form = event.target.closest('#alumnos-detalle-form');
				if (!form) { return; }
				event.preventDefault();
				const studentId = form.getAttribute('data-student-id');
				const student = alumnosMockData.students.find(function (s) { return s.id === studentId; });
				if (!student) { return; }

				const fn = (document.getElementById('detalle-firstname') || {}).value || '';
				const pa = (document.getElementById('detalle-paternal') || {}).value || '';
				const ma = (document.getElementById('detalle-maternal') || {}).value || '';
				const bd = (document.getElementById('detalle-birthdate') || {}).value || '';
				const newStatus = (document.getElementById('detalle-status-value') || {}).value || student.status;

				if (!fn.trim() || !pa.trim() || !bd) { return; }

				const displayName = [fn.trim(), pa.trim(), ma.trim()].filter(Boolean).join(' ');
				const fullNameCurp = [pa.trim(), ma.trim(), fn.trim()].filter(Boolean).join(' ');
				const newCurp = buildCurpByNameAndBirthDate(fullNameCurp, bd) || 'PENDIENTE';
				const birthDate = new Date(bd + 'T00:00:00');
				const birthdayMonth = !Number.isNaN(birthDate.getTime()) && birthDate.getMonth() === new Date().getMonth();
				const statusConfig = statusInsights[newStatus] || statusInsights.proceso;

				student.name = displayName;
				student.firstName = fn.trim();
				student.paternalLastName = pa.trim();
				student.maternalLastName = ma.trim();
				student.birthDate = bd;
				student.birthdayText = formatBirthDateLabel(bd);
				student.birthdayMonth = birthdayMonth;
				student.status = newStatus;
				student.curp = newCurp;
				student.strength = statusConfig.strength;
				student.focus = statusConfig.focus;

				persistStudents();
				refreshDashboard();

				const titleEl = document.getElementById('alumnos-detalle-offcanvas-title');
				if (titleEl) { titleEl.textContent = displayName; }
				const curpDisplay = document.getElementById('detalle-curp-display');
				if (curpDisplay) { curpDisplay.textContent = newCurp; }

				const saveBtn = form.querySelector('[type="submit"]');
				if (saveBtn) {
					const orig = saveBtn.textContent;
					saveBtn.textContent = '¡Guardado!';
					saveBtn.disabled = true;
					window.setTimeout(function () {
						saveBtn.textContent = orig;
						saveBtn.disabled = false;
					}, 1800);
				}
			});
		}
	}

	function renderAttendanceModal() {
		const body = document.getElementById('alumnos-asistencia-body');
		const fechaEl = document.getElementById('alumnos-asistencia-fecha');
		if (!body) return;

		const today = new Date().toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
		if (fechaEl) fechaEl.textContent = today.charAt(0).toUpperCase() + today.slice(1);

		const students = alumnosMockData.students;
		if (!students.length) {
			body.innerHTML = '<p class="text-muted text-center py-4">No hay alumnos registrados.</p>';
			return;
		}

		body.innerHTML = [
			'<div class="planos-table-wrap table-responsive">',
			'<table class="table table-hover align-middle planos-table mb-0">',
			'<thead><tr>',
			'<th scope="col">#</th>',
			'<th scope="col">Alumno</th>',
			'<th scope="col" class="text-center">Presente</th>',
			'<th scope="col" class="text-center">Falta</th>',
			'<th scope="col" class="text-center">Retardo</th>',
			'</tr></thead>',
			'<tbody>',
			students.map(function (student, index) {
				return [
					'<tr>',
					'<td class="text-muted small">' + (index + 1) + '</td>',
					'<td><strong>' + student.name + '</strong></td>',
					'<td class="text-center">',
					'<input type="radio" name="asist-' + student.id + '" value="presente" id="asist-p-' + student.id + '" class="form-check-input" checked>',
					'<label class="visually-hidden" for="asist-p-' + student.id + '">Presente</label>',
					'</td>',
					'<td class="text-center">',
					'<input type="radio" name="asist-' + student.id + '" value="falta" id="asist-f-' + student.id + '" class="form-check-input">',
					'<label class="visually-hidden" for="asist-f-' + student.id + '">Falta</label>',
					'</td>',
					'<td class="text-center">',
					'<input type="radio" name="asist-' + student.id + '" value="retardo" id="asist-r-' + student.id + '" class="form-check-input">',
					'<label class="visually-hidden" for="asist-r-' + student.id + '">Retardo</label>',
					'</td>',
					'</tr>'
				].join('');
			}).join(''),
			'</tbody></table></div>'
		].join('');
	}

	function saveAttendance() {
		const students = alumnosMockData.students;
		if (!students.length) return;

		const dateKey = new Date().toISOString().slice(0, 10);
		students.forEach(function (student) {
			const radio = document.querySelector('input[name="asist-' + student.id + '"]:checked');
			const value = radio ? radio.value : 'presente';
			if (!student.attendanceLog) student.attendanceLog = {};
			student.attendanceLog[dateKey] = value;
		});
		persistStudents();

		const modalEl = document.getElementById('alumnos-asistencia-modal');
		if (modalEl && window.bootstrap && window.bootstrap.Modal) {
			window.bootstrap.Modal.getInstance(modalEl).hide();
		}
	}

	function esc(value) {
		return String(value || '')
			.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
	}

	function reportSharedStyles() {
		return [
			'*{box-sizing:border-box;margin:0;padding:0;}',
			'body{font-family:Arial,sans-serif;background:#f2f4fb;color:#1d2338;padding:0;}',
			'.sheet{max-width:980px;margin:24px auto;background:#fff;border-radius:18px;padding:28px 32px;box-shadow:0 18px 45px rgba(26,35,68,.15);}',
			'.hero{padding:20px 22px;border-radius:14px;color:#fff;margin-bottom:20px;background:linear-gradient(135deg,#103f91,#2f7ad3);}',
			'.hero h1{font-size:22px;line-height:1.25;margin-bottom:6px;}',
			'.hero p{font-size:13px;opacity:.9;}',
			'.meta{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:20px;}',
			'.meta-item{background:#f7f9ff;border:1px solid #dde5fb;border-radius:10px;padding:10px;}',
			'.meta-item strong{display:block;font-size:10px;color:#64719a;text-transform:uppercase;margin-bottom:4px;letter-spacing:.04em;}',
			'.meta-item span{font-size:14px;font-weight:700;color:#223056;}',
			'.block{margin-top:20px;}',
			'.block-title{font-size:14px;color:#20345e;font-weight:700;margin-bottom:10px;padding-bottom:6px;border-bottom:2px solid #e4ebff;}',
			'table{width:100%;border-collapse:collapse;font-size:12px;}',
			'th,td{border:1px solid #dfe6fb;padding:8px 10px;vertical-align:middle;}',
			'th{background:#eef3ff;text-align:left;color:#2a3c66;font-size:11px;text-transform:uppercase;letter-spacing:.04em;}',
			'tr:nth-child(even) td{background:#fafbff;}',
			'.pill{display:inline-block;padding:3px 9px;border-radius:999px;font-weight:700;font-size:11px;}',
			'.pill-p{background:#e6f9ef;border:1px solid #b2e8ca;color:#1a6e3a;}',
			'.pill-f{background:#fde8e8;border:1px solid #f5b8b8;color:#9b1c1c;}',
			'.pill-r{background:#fef3cd;border:1px solid #f9d46a;color:#7a5800;}',
			'.pill-n{background:#f0f0f0;border:1px solid #ccc;color:#555;}',
			'.foot{margin-top:20px;font-size:11px;color:#4a587f;text-align:right;}',
			'@media print{body{background:#fff;}.sheet{margin:0;box-shadow:none;border-radius:0;padding:16px 20px;}.meta{grid-template-columns:repeat(2,minmax(0,1fr));}}'
		].join('');
	}

	function openReport(html) {
		const win = window.open('', '_blank', 'width=900,height=660');
		if (!win) return;
		win.document.write(html);
		win.document.close();
	}

	function printStudentList() {
		const students = alumnosMockData.students;
		const now = new Date();
		const todayLabel = now.toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
		const timeLabel = now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
		const total = students.length;

		const rows = students.map(function (student, index) {
			return [
				'<tr>',
				'<td style="text-align:center;color:#64719a;font-size:11px;">' + (index + 1) + '</td>',
				'<td><strong>' + esc(student.name) + '</strong><br><span style="font-size:10px;color:#64719a;">' + esc(student.grade) + ' &middot; CURP: ' + esc(student.curp || 'pendiente') + '</span></td>',
				'<td style="text-align:center;font-size:16px;">&#x25A1;</td>',
				'<td style="text-align:center;font-size:16px;">&#x25A1;</td>',
				'<td style="text-align:center;font-size:16px;">&#x25A1;</td>',
				'</tr>'
			].join('');
		}).join('');

		const html = [
			'<!doctype html><html lang="es-MX"><head><meta charset="utf-8">',
			'<title>Lista de asistencia &mdash; ' + esc(alumnosMockData.classRoom) + '</title>',
			'<style>' + reportSharedStyles() + '</style>',
			'</head><body>',
			'<div class="sheet">',
			  '<div class="hero">',
			    '<h1>Lista de asistencia</h1>',
			    '<p>' + esc(alumnosMockData.classRoom) + ' &mdash; ' + esc(todayLabel) + ' &mdash; ' + esc(timeLabel) + '</p>',
			  '</div>',
			  '<div class="meta">',
			    '<div class="meta-item"><strong>Grupo</strong><span>' + esc(alumnosMockData.classRoom) + '</span></div>',
			    '<div class="meta-item"><strong>Fecha</strong><span>' + esc(now.toLocaleDateString('es-MX')) + '</span></div>',
			    '<div class="meta-item"><strong>Total alumnos</strong><span>' + total + '</span></div>',
			    '<div class="meta-item"><strong>Hora</strong><span>' + esc(timeLabel) + '</span></div>',
			  '</div>',
			  '<div class="block">',
			    '<p class="block-title">Registro de asistencia del dia</p>',
			    '<table>',
			      '<thead><tr>',
			        '<th style="width:36px;">#</th>',
			        '<th>Alumno</th>',
			        '<th style="width:82px;text-align:center;">&#x2714; Presente</th>',
			        '<th style="width:82px;text-align:center;">&#x2716; Falta</th>',
			        '<th style="width:82px;text-align:center;">&#x23F1; Retardo</th>',
			      '</tr></thead>',
			      '<tbody>' + rows + '</tbody>',
			    '</table>',
			  '</div>',
			  '<div class="block" style="margin-top:16px;">',
			    '<table style="font-size:11px;"><thead><tr>',
			      '<th>Firma del docente</th><th>Firma director(a)</th><th>Sello</th>',
			    '</tr></thead><tbody><tr>',
			      '<td style="height:52px;"></td><td></td><td></td>',
			    '</tr></tbody></table>',
			  '</div>',
			  '<p class="foot">Generado desde Maletin Primaria &mdash; Usa &ldquo;Guardar como PDF&rdquo; en el dialogo de impresion.</p>',
			'</div>',
			'<script>window.onload=function(){window.print();}</' + 'script>',
			'</body></html>'
		].join('');

		openReport(html);
	}

	function printAttendanceHistory() {
		const students = alumnosMockData.students;
		if (!students.length) { alert('No hay alumnos registrados.'); return; }

		// Recolectar todas las fechas del historial
		const dateSet = new Set();
		students.forEach(function (s) {
			if (s.attendanceLog && typeof s.attendanceLog === 'object') {
				Object.keys(s.attendanceLog).forEach(function (d) { dateSet.add(d); });
			}
		});
		const dates = Array.from(dateSet).sort();

		if (!dates.length) { alert('Aun no hay sesiones de asistencia guardadas.'); return; }

		const now = new Date();
		const todayLabel = now.toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });

		function pillFor(value) {
			if (value === 'presente') return '<span class="pill pill-p">P</span>';
			if (value === 'falta')    return '<span class="pill pill-f">F</span>';
			if (value === 'retardo')  return '<span class="pill pill-r">R</span>';
			return '<span class="pill pill-n">-</span>';
		}

		function shortDate(iso) {
			const d = new Date(iso + 'T00:00:00');
			return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
		}

		// Resumen por alumno
		const statsRows = students.map(function (student, index) {
			const log = student.attendanceLog || {};
			const presentes = dates.filter(function (d) { return log[d] === 'presente'; }).length;
			const faltas    = dates.filter(function (d) { return log[d] === 'falta'; }).length;
			const retardos  = dates.filter(function (d) { return log[d] === 'retardo'; }).length;
			const pct = dates.length ? Math.round((presentes / dates.length) * 100) : 0;
			const cells = dates.map(function (d) {
				return '<td style="text-align:center;">' + pillFor(log[d]) + '</td>';
			}).join('');
			return [
				'<tr>',
				'<td style="text-align:center;color:#64719a;font-size:11px;">' + (index + 1) + '</td>',
				'<td><strong>' + esc(student.name) + '</strong></td>',
				cells,
				'<td style="text-align:center;"><strong>' + presentes + '</strong></td>',
				'<td style="text-align:center;color:#9b1c1c;"><strong>' + faltas + '</strong></td>',
				'<td style="text-align:center;color:#7a5800;"><strong>' + retardos + '</strong></td>',
				'<td style="text-align:center;"><strong>' + pct + '%</strong></td>',
				'</tr>'
			].join('');
		}).join('');

		const dateHeaders = dates.map(function (d) {
			return '<th style="text-align:center;min-width:44px;">' + esc(shortDate(d)) + '</th>';
		}).join('');

		const html = [
			'<!doctype html><html lang="es-MX"><head><meta charset="utf-8">',
			'<title>Historial de asistencias &mdash; ' + esc(alumnosMockData.classRoom) + '</title>',
			'<style>' + reportSharedStyles() + 'table{font-size:11px;}</style>',
			'</head><body>',
			'<div class="sheet">',
			  '<div class="hero" style="background:linear-gradient(135deg,#1a3a6a,#1f6db5);">',
			    '<h1>Historial de asistencias</h1>',
			    '<p>' + esc(alumnosMockData.classRoom) + ' &mdash; Reporte generado el ' + esc(todayLabel) + '</p>',
			  '</div>',
			  '<div class="meta">',
			    '<div class="meta-item"><strong>Grupo</strong><span>' + esc(alumnosMockData.classRoom) + '</span></div>',
			    '<div class="meta-item"><strong>Alumnos</strong><span>' + students.length + '</span></div>',
			    '<div class="meta-item"><strong>Sesiones registradas</strong><span>' + dates.length + '</span></div>',
			    '<div class="meta-item"><strong>Periodo</strong><span>' + esc(shortDate(dates[0])) + ' &mdash; ' + esc(shortDate(dates[dates.length - 1])) + '</span></div>',
			  '</div>',
			  '<div class="block">',
			    '<p class="block-title">Registro por sesion</p>',
			    '<div style="overflow-x:auto;">',
			    '<table>',
			      '<thead><tr>',
			        '<th style="width:32px;">#</th>',
			        '<th style="min-width:160px;">Alumno</th>',
			        dateHeaders,
			        '<th style="text-align:center;">Pres.</th>',
			        '<th style="text-align:center;">Faltas</th>',
			        '<th style="text-align:center;">Ret.</th>',
			        '<th style="text-align:center;">Asist.</th>',
			      '</tr></thead>',
			      '<tbody>' + statsRows + '</tbody>',
			    '</table>',
			    '</div>',
			  '</div>',
			  '<div class="block" style="margin-top:12px;">',
			    '<p class="block-title">Leyenda</p>',
			    '<div style="display:flex;gap:16px;font-size:12px;">',
			      '<span><span class="pill pill-p">P</span> Presente</span>',
			      '<span><span class="pill pill-f">F</span> Falta</span>',
			      '<span><span class="pill pill-r">R</span> Retardo</span>',
			      '<span><span class="pill pill-n">-</span> Sin registro</span>',
			    '</div>',
			  '</div>',
			  '<p class="foot">Generado desde Maletin Primaria &mdash; Usa &ldquo;Guardar como PDF&rdquo; en el dialogo de impresion.</p>',
			'</div>',
			'<script>window.onload=function(){window.print();}</' + 'script>',
			'</body></html>'
		].join('');

		openReport(html);
	}

	function printActivitiesReport() {
		const ASSISTANT_STATE_KEY = 'maletinAssistantStateV1';
		let assistantState = null;
		try {
			assistantState = JSON.parse(localStorage.getItem(ASSISTANT_STATE_KEY) || 'null');
		} catch (_) {}

		const active = assistantState && assistantState.activeExperience;
		const now = new Date();
		const todayLabel = now.toLocaleDateString('es-MX', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

		function renderActiveBlock() {
			if (!active) {
				return '<p style="color:#64719a;font-size:13px;">No hay una experiencia activa en este momento. Inicia una experiencia en modo inteligente para ver el resumen aqui.</p>';
			}
			const tasks = Array.isArray(active.todayTasks) ? active.todayTasks : [];
			const tasksHtml = tasks.length
				? '<ul style="margin:8px 0 0 16px;font-size:12px;line-height:1.7;color:#2a3c66;">' + tasks.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>'
				: '<p style="font-size:12px;color:#64719a;margin-top:6px;">Sin actividades registradas para esta sesion.</p>';
			return [
				'<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-bottom:16px;">',
				  '<div class="meta-item"><strong>Sesion actual</strong><span>' + esc(String(active.currentSession || 1)) + ' / ' + esc(String(active.totalSessions || '?')) + '</span></div>',
				  '<div class="meta-item"><strong>Avance</strong><span>' + esc(String(active.progress || 0)) + '%</span></div>',
				  '<div class="meta-item"><strong>Sesiones restantes</strong><span>' + esc(String(active.remainingSessions || 0)) + '</span></div>',
				'</div>',
				'<div style="background:#f7f9ff;border:1px solid #dde5fb;border-radius:10px;padding:12px;margin-bottom:12px;">',
				  '<strong style="font-size:12px;color:#2a3c66;display:block;margin-bottom:4px;">Metodologia</strong>',
				  '<span style="font-size:13px;color:#223056;">' + esc(active.metodologia || '—') + '</span>',
				'</div>',
				'<div style="background:#f7f9ff;border:1px solid #dde5fb;border-radius:10px;padding:12px;margin-bottom:12px;">',
				  '<strong style="font-size:12px;color:#2a3c66;display:block;margin-bottom:4px;">Momento metodologico actual</strong>',
				  '<span style="font-size:13px;color:#223056;">' + esc(active.currentMoment || '—') + '</span>',
				'</div>',
				'<div style="background:#f7f9ff;border:1px solid #dde5fb;border-radius:10px;padding:12px;">',
				  '<strong style="font-size:12px;color:#2a3c66;display:block;margin-bottom:2px;">Actividades de hoy</strong>',
				  tasksHtml,
				'</div>'
			].join('');
		}

		const studentRows = alumnosMockData.students.map(function (student, index) {
			const log = student.attendanceLog || {};
			const keys = Object.keys(log).sort();
			const last = keys.length ? log[keys[keys.length - 1]] : null;
			const presentes = keys.filter(function (d) { return log[d] === 'presente'; }).length;
			const pct = keys.length ? Math.round((presentes / keys.length) * 100) : null;
			return [
				'<tr>',
				'<td style="text-align:center;color:#64719a;font-size:11px;">' + (index + 1) + '</td>',
				'<td><strong>' + esc(student.name) + '</strong></td>',
				'<td><span class="pill ' + (student.status === 'destacado' ? 'pill-p' : student.status === 'apoyo' ? 'pill-f' : 'pill-r') + '">' + esc(student.status) + '</span></td>',
				'<td style="text-align:center;">' + (pct !== null ? pct + '%' : '<span style="color:#aaa;">—</span>') + '</td>',
				'<td style="text-align:center;">' + (last ? (last === 'presente' ? '<span class="pill pill-p">P</span>' : last === 'falta' ? '<span class="pill pill-f">F</span>' : '<span class="pill pill-r">R</span>') : '<span style="color:#aaa;">—</span>') + '</td>',
				'</tr>'
			].join('');
		}).join('');

		const html = [
			'<!doctype html><html lang="es-MX"><head><meta charset="utf-8">',
			'<title>Reporte de actividades &mdash; ' + esc(alumnosMockData.classRoom) + '</title>',
			'<style>' + reportSharedStyles() + '</style>',
			'</head><body>',
			'<div class="sheet">',
			  '<div class="hero" style="background:linear-gradient(135deg,#2d1b69,#5b2fc1);">',
			    '<h1>Reporte de actividades en curso</h1>',
			    '<p>' + esc(alumnosMockData.classRoom) + ' &mdash; ' + esc(todayLabel) + (active ? ' &mdash; ' + esc(active.title) : '') + '</p>',
			  '</div>',
			  '<div class="meta">',
			    '<div class="meta-item"><strong>Grupo</strong><span>' + esc(alumnosMockData.classRoom) + '</span></div>',
			    '<div class="meta-item"><strong>Experiencia activa</strong><span>' + esc(active ? active.title : 'Sin experiencia activa') + '</span></div>',
			    '<div class="meta-item"><strong>Producto</strong><span>' + esc(active ? (active.product || '—') : '—') + '</span></div>',
			    '<div class="meta-item"><strong>Cierre estimado</strong><span>' + esc(active ? (active.estimatedEndLabel || '—') : '—') + '</span></div>',
			  '</div>',
			  '<div class="block">',
			    '<p class="block-title">Estado de la experiencia</p>',
			    renderActiveBlock(),
			  '</div>',
			  '<div class="block">',
			    '<p class="block-title">Grupo &mdash; resumen de asistencia y estatus</p>',
			    '<table>',
			      '<thead><tr>',
			        '<th style="width:32px;">#</th>',
			        '<th>Alumno</th>',
			        '<th>Estatus</th>',
			        '<th style="text-align:center;">Asistencia</th>',
			        '<th style="text-align:center;">Ultima sesion</th>',
			      '</tr></thead>',
			      '<tbody>' + studentRows + '</tbody>',
			    '</table>',
			  '</div>',
			  '<p class="foot">Generado desde Maletin Primaria &mdash; Usa &ldquo;Guardar como PDF&rdquo; en el dialogo de impresion.</p>',
			'</div>',
			'<script>window.onload=function(){window.print();}</' + 'script>',
			'</body></html>'
		].join('');

		openReport(html);
	}

	function init() {
		renderHeroMetrics();
		renderKpis();
		renderAttendance();
		renderProgress();
		renderBirthdays();
		syncBirthdayCardHeight();
		renderAlerts();
		renderSimpleList('alumnos-action-list', alumnosMockData.actions, 'Accion sugerida');
		renderFieldProgress();
		renderStudentGrid();
		renderStudentTable();
		renderBuilderControls();
		renderDraftStudents();
		syncActiveChip();
		bindEvents();


	window.addEventListener('storage', renderFieldProgress);
		if (!alumnosMockData.students.length) {
			openAddStudentModal();
		}
	}

	window.addEventListener('resize', syncBirthdayCardHeight);

	init();
}());
