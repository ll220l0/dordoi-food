export const formatKgs = (a:number)=> new Intl.NumberFormat('ru-RU',{maximumFractionDigits:0}).format(a)+' KGS';
