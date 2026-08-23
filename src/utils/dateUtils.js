/**
 * Tarihi Türkçe formatında göster
 * @param {number} timestamp - Milisaniye cinsinden zaman
 * @returns {string} Formatlanmış tarih
 */
export const formatDate = (timestamp) => {
	const date = new Date(timestamp);
	const options = {
		year: "numeric",
		month: "long",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	};
	return date.toLocaleDateString("tr-TR", options);
};

/**
 * Tarihi kısa formatında göster (GG.AA.YYYY)
 * @param {number} timestamp - Milisaniye cinsinden zaman
 * @returns {string} Formatlanmış tarih
 */
export const formatDateShort = (timestamp) => {
	const date = new Date(timestamp);
	const day = String(date.getDate()).padStart(2, "0");
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const year = date.getFullYear();
	return `${day}.${month}.${year}`;
};

/**
 * Tarihi saat:dakika formatında göster
 * @param {number} timestamp - Milisaniye cinsinden zaman
 * @returns {string} Formatlanmış saat
 */
export const formatTime = (timestamp) => {
	const date = new Date(timestamp);
	const hours = String(date.getHours()).padStart(2, "0");
	const minutes = String(date.getMinutes()).padStart(2, "0");
	return `${hours}:${minutes}`;
};

/**
 * Bugünün tarihini başlık için uygun formattta döndürür.
 * Örn: "23.08.2026"
 */
export const getTodayAsTitle = (timestamp = Date.now()) => {
	const date = new Date(timestamp);
	return date.toLocaleDateString("tr-TR", {
		year: "numeric",
		month: "numeric",
		day: "numeric",
	});
};
