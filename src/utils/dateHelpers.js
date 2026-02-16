/**
 * Utilitaires pour la gestion des dates
 */

// Formater une date en français
const formatDateFR = (date) => {
    if (!date) return null;
    const d = new Date(date);
    return d.toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
};

// Formater une date courte (JJ/MM/AAAA)
const formatDateShortFR = (date) => {
    if (!date) return null;
    const d = new Date(date);
    return d.toLocaleDateString('fr-FR');
};

// Formater date et heure
const formatDateTimeFR = (date) => {
    if (!date) return null;
    const d = new Date(date);
    return d.toLocaleString('fr-FR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

// Obtenir la semaine courante (lundi à dimanche)
const getCurrentWeek = () => {
    const now = new Date();
    const dayOfWeek = now.getDay() || 7; // Dimanche = 7

    const monday = new Date(now);
    monday.setDate(now.getDate() - dayOfWeek + 1);
    monday.setHours(0, 0, 0, 0);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    return {
        start: monday.toISOString().split('T')[0],
        end: sunday.toISOString().split('T')[0],
        startDate: monday,
        endDate: sunday
    };
};

// Obtenir le mois courant
const getCurrentMonth = () => {
    const now = new Date();

    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    firstDay.setHours(0, 0, 0, 0);

    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    lastDay.setHours(23, 59, 59, 999);

    return {
        start: firstDay.toISOString().split('T')[0],
        end: lastDay.toISOString().split('T')[0],
        startDate: firstDay,
        endDate: lastDay
    };
};

// Obtenir le trimestre courant
const getCurrentQuarter = () => {
    const now = new Date();
    const quarter = Math.floor(now.getMonth() / 3);

    const firstDay = new Date(now.getFullYear(), quarter * 3, 1);
    firstDay.setHours(0, 0, 0, 0);

    const lastDay = new Date(now.getFullYear(), (quarter + 1) * 3, 0);
    lastDay.setHours(23, 59, 59, 999);

    return {
        start: firstDay.toISOString().split('T')[0],
        end: lastDay.toISOString().split('T')[0],
        startDate: firstDay,
        endDate: lastDay,
        quarter: quarter + 1
    };
};

// Obtenir l'année courante
const getCurrentYear = () => {
    const now = new Date();

    const firstDay = new Date(now.getFullYear(), 0, 1);
    firstDay.setHours(0, 0, 0, 0);

    const lastDay = new Date(now.getFullYear(), 11, 31);
    lastDay.setHours(23, 59, 59, 999);

    return {
        start: firstDay.toISOString().split('T')[0],
        end: lastDay.toISOString().split('T')[0],
        startDate: firstDay,
        endDate: lastDay,
        year: now.getFullYear()
    };
};

// Obtenir la semaine précédente
const getPreviousWeek = () => {
    const current = getCurrentWeek();
    const prevMonday = new Date(current.startDate);
    prevMonday.setDate(prevMonday.getDate() - 7);

    const prevSunday = new Date(prevMonday);
    prevSunday.setDate(prevMonday.getDate() + 6);

    return {
        start: prevMonday.toISOString().split('T')[0],
        end: prevSunday.toISOString().split('T')[0],
        startDate: prevMonday,
        endDate: prevSunday
    };
};

// Obtenir le mois précédent
const getPreviousMonth = () => {
    const now = new Date();

    const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    firstDay.setHours(0, 0, 0, 0);

    const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
    lastDay.setHours(23, 59, 59, 999);

    return {
        start: firstDay.toISOString().split('T')[0],
        end: lastDay.toISOString().split('T')[0],
        startDate: firstDay,
        endDate: lastDay
    };
};

// Vérifier si une période est valide
const isValidPeriod = (startDate, endDate) => {
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return { valid: false, error: 'Dates invalides' };
    }

    if (end <= start) {
        return { valid: false, error: 'La date de fin doit être après la date de début' };
    }

    return { valid: true };
};

// Calculer le nombre de jours entre deux dates
const daysBetween = (startDate, endDate) => {
    const start = new Date(startDate);
    const end = new Date(endDate);

    const diffTime = Math.abs(end - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return diffDays;
};

// Calculer le nombre de semaines entre deux dates
const weeksBetween = (startDate, endDate) => {
    const days = daysBetween(startDate, endDate);
    return Math.ceil(days / 7);
};

// Vérifier si une date est dans le passé
const isPast = (date) => {
    return new Date(date) < new Date();
};

// Vérifier si une date est dans le futur
const isFuture = (date) => {
    return new Date(date) > new Date();
};

// Vérifier si une date est aujourd'hui
const isToday = (date) => {
    const d = new Date(date);
    const today = new Date();

    return d.getDate() === today.getDate() &&
        d.getMonth() === today.getMonth() &&
        d.getFullYear() === today.getFullYear();
};

// Vérifier si une date est cette semaine
const isThisWeek = (date) => {
    const week = getCurrentWeek();
    const d = new Date(date);

    return d >= week.startDate && d <= week.endDate;
};

// Vérifier si une date est ce mois
const isThisMonth = (date) => {
    const d = new Date(date);
    const now = new Date();

    return d.getMonth() === now.getMonth() &&
        d.getFullYear() === now.getFullYear();
};

// Ajouter des jours à une date
const addDays = (date, days) => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
};

// Ajouter des mois à une date
const addMonths = (date, months) => {
    const result = new Date(date);
    result.setMonth(result.getMonth() + months);
    return result;
};

// Obtenir le nom du jour en français
const getDayNameFR = (date) => {
    const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    return days[new Date(date).getDay()];
};

// Obtenir le nom du mois en français
const getMonthNameFR = (date) => {
    const months = [
        'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
        'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
    ];
    return months[new Date(date).getMonth()];
};

// Obtenir une plage de dates pour différentes fréquences
const getDateRangeForFrequency = (frequency, referenceDate = new Date()) => {
    switch (frequency) {
        case 'hebdomadaire':
            return getCurrentWeek();

        case 'mensuel':
            return getCurrentMonth();

        case 'trimestriel':
            return getCurrentQuarter();

        case 'annuel':
            return getCurrentYear();

        default:
            return getCurrentMonth();
    }
};

// Formater une période pour affichage
const formatPeriod = (startDate, endDate) => {
    const start = formatDateShortFR(startDate);
    const end = formatDateShortFR(endDate);
    return `${start} - ${end}`;
};

// Calculer le temps relatif (il y a X jours/heures)
const timeAgo = (date) => {
    const now = new Date();
    const then = new Date(date);
    const diffMs = now - then;
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 30) {
        return formatDateShortFR(date);
    } else if (diffDays > 0) {
        return `Il y a ${diffDays} jour${diffDays > 1 ? 's' : ''}`;
    } else if (diffHours > 0) {
        return `Il y a ${diffHours} heure${diffHours > 1 ? 's' : ''}`;
    } else if (diffMins > 0) {
        return `Il y a ${diffMins} minute${diffMins > 1 ? 's' : ''}`;
    } else {
        return 'À l\'instant';
    }
};

module.exports = {
    formatDateFR,
    formatDateShortFR,
    formatDateTimeFR,
    getCurrentWeek,
    getCurrentMonth,
    getCurrentQuarter,
    getCurrentYear,
    getPreviousWeek,
    getPreviousMonth,
    isValidPeriod,
    daysBetween,
    weeksBetween,
    isPast,
    isFuture,
    isToday,
    isThisWeek,
    isThisMonth,
    addDays,
    addMonths,
    getDayNameFR,
    getMonthNameFR,
    getDateRangeForFrequency,
    formatPeriod,
    timeAgo
};