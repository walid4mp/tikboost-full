const COUNTRIES = [
  {
    "code": "AD",
    "nameAr": "أندورا",
    "nameEn": "Andorra",
    "flag": "🇦🇩"
  },
  {
    "code": "AE",
    "nameAr": "الإمارات العربية المتحدة",
    "nameEn": "United Arab Emirates",
    "flag": "🇦🇪"
  },
  {
    "code": "AF",
    "nameAr": "أفغانستان",
    "nameEn": "Afghanistan",
    "flag": "🇦🇫"
  },
  {
    "code": "AG",
    "nameAr": "أنتيغوا وباربودا",
    "nameEn": "Antigua and Barbuda",
    "flag": "🇦🇬"
  },
  {
    "code": "AI",
    "nameAr": "أنغويلا",
    "nameEn": "Anguilla",
    "flag": "🇦🇮"
  },
  {
    "code": "AL",
    "nameAr": "ألبانيا",
    "nameEn": "Albania",
    "flag": "🇦🇱"
  },
  {
    "code": "AM",
    "nameAr": "أرمينيا",
    "nameEn": "Armenia",
    "flag": "🇦🇲"
  },
  {
    "code": "AO",
    "nameAr": "أنغولا",
    "nameEn": "Angola",
    "flag": "🇦🇴"
  },
  {
    "code": "AQ",
    "nameAr": "القارة القطبية الجنوبية",
    "nameEn": "Antarctica",
    "flag": "🇦🇶"
  },
  {
    "code": "AR",
    "nameAr": "الأرجنتين",
    "nameEn": "Argentina",
    "flag": "🇦🇷"
  },
  {
    "code": "AS",
    "nameAr": "ساموا الأمريكية",
    "nameEn": "American Samoa",
    "flag": "🇦🇸"
  },
  {
    "code": "AT",
    "nameAr": "النمسا",
    "nameEn": "Austria",
    "flag": "🇦🇹"
  },
  {
    "code": "AU",
    "nameAr": "أستراليا",
    "nameEn": "Australia",
    "flag": "🇦🇺"
  },
  {
    "code": "AW",
    "nameAr": "أروبا",
    "nameEn": "Aruba",
    "flag": "🇦🇼"
  },
  {
    "code": "AX",
    "nameAr": "جزر أولاند",
    "nameEn": "Åland Islands",
    "flag": "🇦🇽"
  },
  {
    "code": "AZ",
    "nameAr": "أذربيجان",
    "nameEn": "Azerbaijan",
    "flag": "🇦🇿"
  },
  {
    "code": "BA",
    "nameAr": "البوسنة والهرسك",
    "nameEn": "Bosnia and Herzegovina",
    "flag": "🇧🇦"
  },
  {
    "code": "BB",
    "nameAr": "باربادوس",
    "nameEn": "Barbados",
    "flag": "🇧🇧"
  },
  {
    "code": "BD",
    "nameAr": "بنغلاديش",
    "nameEn": "Bangladesh",
    "flag": "🇧🇩"
  },
  {
    "code": "BE",
    "nameAr": "بلجيكا",
    "nameEn": "Belgium",
    "flag": "🇧🇪"
  },
  {
    "code": "BF",
    "nameAr": "بوركينا فاسو",
    "nameEn": "Burkina Faso",
    "flag": "🇧🇫"
  },
  {
    "code": "BG",
    "nameAr": "بلغاريا",
    "nameEn": "Bulgaria",
    "flag": "🇧🇬"
  },
  {
    "code": "BH",
    "nameAr": "البحرين",
    "nameEn": "Bahrain",
    "flag": "🇧🇭"
  },
  {
    "code": "BI",
    "nameAr": "بوروندي",
    "nameEn": "Burundi",
    "flag": "🇧🇮"
  },
  {
    "code": "BJ",
    "nameAr": "بنين",
    "nameEn": "Benin",
    "flag": "🇧🇯"
  },
  {
    "code": "BL",
    "nameAr": "سان بارتيلمي",
    "nameEn": "Saint Barthélemy",
    "flag": "🇧🇱"
  },
  {
    "code": "BM",
    "nameAr": "برمودا",
    "nameEn": "Bermuda",
    "flag": "🇧🇲"
  },
  {
    "code": "BN",
    "nameAr": "بروناي",
    "nameEn": "Brunei Darussalam",
    "flag": "🇧🇳"
  },
  {
    "code": "BO",
    "nameAr": "بوليفيا",
    "nameEn": "Bolivia",
    "flag": "🇧🇴"
  },
  {
    "code": "BQ",
    "nameAr": "الجزر الكاريبية الهولندية",
    "nameEn": "Bonaire, Sint Eustatius and Saba",
    "flag": "🇧🇶"
  },
  {
    "code": "BR",
    "nameAr": "البرازيل",
    "nameEn": "Brazil",
    "flag": "🇧🇷"
  },
  {
    "code": "BS",
    "nameAr": "باهاماس",
    "nameEn": "Bahamas",
    "flag": "🇧🇸"
  },
  {
    "code": "BT",
    "nameAr": "بوتان",
    "nameEn": "Bhutan",
    "flag": "🇧🇹"
  },
  {
    "code": "BV",
    "nameAr": "جزيرة بوفيه",
    "nameEn": "Bouvet Island",
    "flag": "🇧🇻"
  },
  {
    "code": "BW",
    "nameAr": "بوتسوانا",
    "nameEn": "Botswana",
    "flag": "🇧🇼"
  },
  {
    "code": "BY",
    "nameAr": "روسيا البيضاء",
    "nameEn": "Belarus",
    "flag": "🇧🇾"
  },
  {
    "code": "BZ",
    "nameAr": "بليز",
    "nameEn": "Belize",
    "flag": "🇧🇿"
  },
  {
    "code": "CA",
    "nameAr": "كندا",
    "nameEn": "Canada",
    "flag": "🇨🇦"
  },
  {
    "code": "CC",
    "nameAr": "جزر كوكوس",
    "nameEn": "Cocos (Keeling) Islands",
    "flag": "🇨🇨"
  },
  {
    "code": "CD",
    "nameAr": "جمهورية الكونغو الديمقراطية",
    "nameEn": "Democratic Republic of the Congo",
    "flag": "🇨🇩"
  },
  {
    "code": "CF",
    "nameAr": "جمهورية أفريقيا الوسطى",
    "nameEn": "Central African Republic",
    "flag": "🇨🇫"
  },
  {
    "code": "CG",
    "nameAr": "جمهورية الكونغو",
    "nameEn": "Republic of the Congo",
    "flag": "🇨🇬"
  },
  {
    "code": "CH",
    "nameAr": "سويسرا",
    "nameEn": "Switzerland",
    "flag": "🇨🇭"
  },
  {
    "code": "CI",
    "nameAr": "ساحل العاج",
    "nameEn": "Cote d'Ivoire",
    "flag": "🇨🇮"
  },
  {
    "code": "CK",
    "nameAr": "جزر كوك",
    "nameEn": "Cook Islands",
    "flag": "🇨🇰"
  },
  {
    "code": "CL",
    "nameAr": "تشيلي",
    "nameEn": "Chile",
    "flag": "🇨🇱"
  },
  {
    "code": "CM",
    "nameAr": "الكاميرون",
    "nameEn": "Cameroon",
    "flag": "🇨🇲"
  },
  {
    "code": "CN",
    "nameAr": "الصين",
    "nameEn": "People's Republic of China",
    "flag": "🇨🇳"
  },
  {
    "code": "CO",
    "nameAr": "كولومبيا",
    "nameEn": "Colombia",
    "flag": "🇨🇴"
  },
  {
    "code": "CR",
    "nameAr": "كوستاريكا",
    "nameEn": "Costa Rica",
    "flag": "🇨🇷"
  },
  {
    "code": "CU",
    "nameAr": "كوبا",
    "nameEn": "Cuba",
    "flag": "🇨🇺"
  },
  {
    "code": "CV",
    "nameAr": "الرأس الأخضر",
    "nameEn": "Cape Verde",
    "flag": "🇨🇻"
  },
  {
    "code": "CW",
    "nameAr": "كوراساو",
    "nameEn": "Curaçao",
    "flag": "🇨🇼"
  },
  {
    "code": "CX",
    "nameAr": "جزيرة عيد الميلاد",
    "nameEn": "Christmas Island",
    "flag": "🇨🇽"
  },
  {
    "code": "CY",
    "nameAr": "قبرص",
    "nameEn": "Cyprus",
    "flag": "🇨🇾"
  },
  {
    "code": "CZ",
    "nameAr": "جمهورية التشيك",
    "nameEn": "Czech Republic",
    "flag": "🇨🇿"
  },
  {
    "code": "DE",
    "nameAr": "ألمانيا",
    "nameEn": "Germany",
    "flag": "🇩🇪"
  },
  {
    "code": "DJ",
    "nameAr": "جيبوتي",
    "nameEn": "Djibouti",
    "flag": "🇩🇯"
  },
  {
    "code": "DK",
    "nameAr": "الدنمارك",
    "nameEn": "Denmark",
    "flag": "🇩🇰"
  },
  {
    "code": "DM",
    "nameAr": "دومينيكا",
    "nameEn": "Dominica",
    "flag": "🇩🇲"
  },
  {
    "code": "DO",
    "nameAr": "جمهورية الدومينيكان",
    "nameEn": "Dominican Republic",
    "flag": "🇩🇴"
  },
  {
    "code": "DZ",
    "nameAr": "الجزائر",
    "nameEn": "Algeria",
    "flag": "🇩🇿"
  },
  {
    "code": "EC",
    "nameAr": "الإكوادور",
    "nameEn": "Ecuador",
    "flag": "🇪🇨"
  },
  {
    "code": "EE",
    "nameAr": "إستونيا",
    "nameEn": "Estonia",
    "flag": "🇪🇪"
  },
  {
    "code": "EG",
    "nameAr": "مصر",
    "nameEn": "Egypt",
    "flag": "🇪🇬"
  },
  {
    "code": "EH",
    "nameAr": "الصحراء الغربية",
    "nameEn": "Western Sahara",
    "flag": "🇪🇭"
  },
  {
    "code": "ER",
    "nameAr": "إريتريا",
    "nameEn": "Eritrea",
    "flag": "🇪🇷"
  },
  {
    "code": "ES",
    "nameAr": "إسبانيا",
    "nameEn": "Spain",
    "flag": "🇪🇸"
  },
  {
    "code": "ET",
    "nameAr": "إثيوبيا",
    "nameEn": "Ethiopia",
    "flag": "🇪🇹"
  },
  {
    "code": "FI",
    "nameAr": "فنلندا",
    "nameEn": "Finland",
    "flag": "🇫🇮"
  },
  {
    "code": "FJ",
    "nameAr": "فيجي",
    "nameEn": "Fiji",
    "flag": "🇫🇯"
  },
  {
    "code": "FK",
    "nameAr": "جزر فوكلاند",
    "nameEn": "Falkland Islands (Malvinas)",
    "flag": "🇫🇰"
  },
  {
    "code": "FM",
    "nameAr": "ولايات ميكرونيسيا المتحدة",
    "nameEn": "Micronesia, Federated States of",
    "flag": "🇫🇲"
  },
  {
    "code": "FO",
    "nameAr": "جزر فارو",
    "nameEn": "Faroe Islands",
    "flag": "🇫🇴"
  },
  {
    "code": "FR",
    "nameAr": "فرنسا",
    "nameEn": "France",
    "flag": "🇫🇷"
  },
  {
    "code": "GA",
    "nameAr": "الغابون",
    "nameEn": "Gabon",
    "flag": "🇬🇦"
  },
  {
    "code": "GB",
    "nameAr": "المملكة المتحدة",
    "nameEn": "United Kingdom",
    "flag": "🇬🇧"
  },
  {
    "code": "GD",
    "nameAr": "غرينادا",
    "nameEn": "Grenada",
    "flag": "🇬🇩"
  },
  {
    "code": "GE",
    "nameAr": "جورجيا",
    "nameEn": "Georgia",
    "flag": "🇬🇪"
  },
  {
    "code": "GF",
    "nameAr": "غويانا الفرنسية",
    "nameEn": "French Guiana",
    "flag": "🇬🇫"
  },
  {
    "code": "GG",
    "nameAr": "غيرنزي",
    "nameEn": "Guernsey",
    "flag": "🇬🇬"
  },
  {
    "code": "GH",
    "nameAr": "غانا",
    "nameEn": "Ghana",
    "flag": "🇬🇭"
  },
  {
    "code": "GI",
    "nameAr": "جبل طارق",
    "nameEn": "Gibraltar",
    "flag": "🇬🇮"
  },
  {
    "code": "GL",
    "nameAr": "جرينلاند",
    "nameEn": "Greenland",
    "flag": "🇬🇱"
  },
  {
    "code": "GM",
    "nameAr": "غامبيا",
    "nameEn": "Republic of The Gambia",
    "flag": "🇬🇲"
  },
  {
    "code": "GN",
    "nameAr": "غينيا",
    "nameEn": "Guinea",
    "flag": "🇬🇳"
  },
  {
    "code": "GP",
    "nameAr": "غوادلوب",
    "nameEn": "Guadeloupe",
    "flag": "🇬🇵"
  },
  {
    "code": "GQ",
    "nameAr": "غينيا الاستوائية",
    "nameEn": "Equatorial Guinea",
    "flag": "🇬🇶"
  },
  {
    "code": "GR",
    "nameAr": "اليونان",
    "nameEn": "Greece",
    "flag": "🇬🇷"
  },
  {
    "code": "GS",
    "nameAr": "جورجيا الجنوبية وجزر ساندويتش الجنوبية",
    "nameEn": "South Georgia and the South Sandwich Islands",
    "flag": "🇬🇸"
  },
  {
    "code": "GT",
    "nameAr": "غواتيمالا",
    "nameEn": "Guatemala",
    "flag": "🇬🇹"
  },
  {
    "code": "GU",
    "nameAr": "غوام",
    "nameEn": "Guam",
    "flag": "🇬🇺"
  },
  {
    "code": "GW",
    "nameAr": "غينيا بيساو",
    "nameEn": "Guinea-Bissau",
    "flag": "🇬🇼"
  },
  {
    "code": "GY",
    "nameAr": "غيانا",
    "nameEn": "Guyana",
    "flag": "🇬🇾"
  },
  {
    "code": "HK",
    "nameAr": "هونغ كونغ",
    "nameEn": "Hong Kong",
    "flag": "🇭🇰"
  },
  {
    "code": "HM",
    "nameAr": "جزيرة هيرد وجزر ماكدونالد",
    "nameEn": "Heard Island and McDonald Islands",
    "flag": "🇭🇲"
  },
  {
    "code": "HN",
    "nameAr": "هندوراس",
    "nameEn": "Honduras",
    "flag": "🇭🇳"
  },
  {
    "code": "HR",
    "nameAr": "كرواتيا",
    "nameEn": "Croatia",
    "flag": "🇭🇷"
  },
  {
    "code": "HT",
    "nameAr": "هايتي",
    "nameEn": "Haiti",
    "flag": "🇭🇹"
  },
  {
    "code": "HU",
    "nameAr": "المجر",
    "nameEn": "Hungary",
    "flag": "🇭🇺"
  },
  {
    "code": "ID",
    "nameAr": "إندونيسيا",
    "nameEn": "Indonesia",
    "flag": "🇮🇩"
  },
  {
    "code": "IE",
    "nameAr": "أيرلندا",
    "nameEn": "Ireland",
    "flag": "🇮🇪"
  },
  {
    "code": "IL",
    "nameAr": "إسرائيل",
    "nameEn": "Israel",
    "flag": "🇮🇱"
  },
  {
    "code": "IM",
    "nameAr": "جزيرة مان",
    "nameEn": "Isle of Man",
    "flag": "🇮🇲"
  },
  {
    "code": "IN",
    "nameAr": "الهند",
    "nameEn": "India",
    "flag": "🇮🇳"
  },
  {
    "code": "IO",
    "nameAr": "إقليم المحيط الهندي البريطاني",
    "nameEn": "British Indian Ocean Territory",
    "flag": "🇮🇴"
  },
  {
    "code": "IQ",
    "nameAr": "العراق",
    "nameEn": "Iraq",
    "flag": "🇮🇶"
  },
  {
    "code": "IR",
    "nameAr": "إيران",
    "nameEn": "Islamic Republic of Iran",
    "flag": "🇮🇷"
  },
  {
    "code": "IS",
    "nameAr": "آيسلندا",
    "nameEn": "Iceland",
    "flag": "🇮🇸"
  },
  {
    "code": "IT",
    "nameAr": "إيطاليا",
    "nameEn": "Italy",
    "flag": "🇮🇹"
  },
  {
    "code": "JE",
    "nameAr": "جيرزي",
    "nameEn": "Jersey",
    "flag": "🇯🇪"
  },
  {
    "code": "JM",
    "nameAr": "جامايكا",
    "nameEn": "Jamaica",
    "flag": "🇯🇲"
  },
  {
    "code": "JO",
    "nameAr": "الأردن",
    "nameEn": "Jordan",
    "flag": "🇯🇴"
  },
  {
    "code": "JP",
    "nameAr": "اليابان",
    "nameEn": "Japan",
    "flag": "🇯🇵"
  },
  {
    "code": "KE",
    "nameAr": "كينيا",
    "nameEn": "Kenya",
    "flag": "🇰🇪"
  },
  {
    "code": "KG",
    "nameAr": "قيرغيزستان",
    "nameEn": "Kyrgyzstan",
    "flag": "🇰🇬"
  },
  {
    "code": "KH",
    "nameAr": "كمبوديا",
    "nameEn": "Cambodia",
    "flag": "🇰🇭"
  },
  {
    "code": "KI",
    "nameAr": "كيريباتي",
    "nameEn": "Kiribati",
    "flag": "🇰🇮"
  },
  {
    "code": "KM",
    "nameAr": "جزر القمر",
    "nameEn": "Comoros",
    "flag": "🇰🇲"
  },
  {
    "code": "KN",
    "nameAr": "سانت كيتس ونيفيس",
    "nameEn": "Saint Kitts and Nevis",
    "flag": "🇰🇳"
  },
  {
    "code": "KP",
    "nameAr": "كوريا الشمالية",
    "nameEn": "North Korea",
    "flag": "🇰🇵"
  },
  {
    "code": "KR",
    "nameAr": "كوريا الجنوبية",
    "nameEn": "South Korea",
    "flag": "🇰🇷"
  },
  {
    "code": "KW",
    "nameAr": "الكويت",
    "nameEn": "Kuwait",
    "flag": "🇰🇼"
  },
  {
    "code": "KY",
    "nameAr": "جزر كايمان",
    "nameEn": "Cayman Islands",
    "flag": "🇰🇾"
  },
  {
    "code": "KZ",
    "nameAr": "كازاخستان",
    "nameEn": "Kazakhstan",
    "flag": "🇰🇿"
  },
  {
    "code": "LA",
    "nameAr": "لاوس",
    "nameEn": "Lao People's Democratic Republic",
    "flag": "🇱🇦"
  },
  {
    "code": "LB",
    "nameAr": "لبنان",
    "nameEn": "Lebanon",
    "flag": "🇱🇧"
  },
  {
    "code": "LC",
    "nameAr": "سانت لوسيا",
    "nameEn": "Saint Lucia",
    "flag": "🇱🇨"
  },
  {
    "code": "LI",
    "nameAr": "ليختنشتاين",
    "nameEn": "Liechtenstein",
    "flag": "🇱🇮"
  },
  {
    "code": "LK",
    "nameAr": "سريلانكا",
    "nameEn": "Sri Lanka",
    "flag": "🇱🇰"
  },
  {
    "code": "LR",
    "nameAr": "ليبيريا",
    "nameEn": "Liberia",
    "flag": "🇱🇷"
  },
  {
    "code": "LS",
    "nameAr": "ليسوتو",
    "nameEn": "Lesotho",
    "flag": "🇱🇸"
  },
  {
    "code": "LT",
    "nameAr": "ليتوانيا",
    "nameEn": "Lithuania",
    "flag": "🇱🇹"
  },
  {
    "code": "LU",
    "nameAr": "لوكسمبورغ",
    "nameEn": "Luxembourg",
    "flag": "🇱🇺"
  },
  {
    "code": "LV",
    "nameAr": "لاتفيا",
    "nameEn": "Latvia",
    "flag": "🇱🇻"
  },
  {
    "code": "LY",
    "nameAr": "ليبيا",
    "nameEn": "Libya",
    "flag": "🇱🇾"
  },
  {
    "code": "MA",
    "nameAr": "المغرب",
    "nameEn": "Morocco",
    "flag": "🇲🇦"
  },
  {
    "code": "MC",
    "nameAr": "موناكو",
    "nameEn": "Monaco",
    "flag": "🇲🇨"
  },
  {
    "code": "MD",
    "nameAr": "مولدوفا",
    "nameEn": "Moldova, Republic of",
    "flag": "🇲🇩"
  },
  {
    "code": "ME",
    "nameAr": "الجبل الأسود",
    "nameEn": "Montenegro",
    "flag": "🇲🇪"
  },
  {
    "code": "MF",
    "nameAr": "سانت مارتن (الجزء الفرنسي)",
    "nameEn": "Saint Martin (French part)",
    "flag": "🇲🇫"
  },
  {
    "code": "MG",
    "nameAr": "مدغشقر",
    "nameEn": "Madagascar",
    "flag": "🇲🇬"
  },
  {
    "code": "MH",
    "nameAr": "جزر مارشال",
    "nameEn": "Marshall Islands",
    "flag": "🇲🇭"
  },
  {
    "code": "MK",
    "nameAr": "مقدونيا الشمالية",
    "nameEn": "The Republic of North Macedonia",
    "flag": "🇲🇰"
  },
  {
    "code": "ML",
    "nameAr": "مالي",
    "nameEn": "Mali",
    "flag": "🇲🇱"
  },
  {
    "code": "MM",
    "nameAr": "بورما",
    "nameEn": "Myanmar",
    "flag": "🇲🇲"
  },
  {
    "code": "MN",
    "nameAr": "منغوليا",
    "nameEn": "Mongolia",
    "flag": "🇲🇳"
  },
  {
    "code": "MO",
    "nameAr": "ماكاو",
    "nameEn": "Macao",
    "flag": "🇲🇴"
  },
  {
    "code": "MP",
    "nameAr": "جزر ماريانا الشمالية",
    "nameEn": "Northern Mariana Islands",
    "flag": "🇲🇵"
  },
  {
    "code": "MQ",
    "nameAr": "مارتينيك",
    "nameEn": "Martinique",
    "flag": "🇲🇶"
  },
  {
    "code": "MR",
    "nameAr": "موريتانيا",
    "nameEn": "Mauritania",
    "flag": "🇲🇷"
  },
  {
    "code": "MS",
    "nameAr": "مونتسرات",
    "nameEn": "Montserrat",
    "flag": "🇲🇸"
  },
  {
    "code": "MT",
    "nameAr": "مالطا",
    "nameEn": "Malta",
    "flag": "🇲🇹"
  },
  {
    "code": "MU",
    "nameAr": "موريشيوس",
    "nameEn": "Mauritius",
    "flag": "🇲🇺"
  },
  {
    "code": "MV",
    "nameAr": "جزر المالديف",
    "nameEn": "Maldives",
    "flag": "🇲🇻"
  },
  {
    "code": "MW",
    "nameAr": "مالاوي",
    "nameEn": "Malawi",
    "flag": "🇲🇼"
  },
  {
    "code": "MX",
    "nameAr": "المكسيك",
    "nameEn": "Mexico",
    "flag": "🇲🇽"
  },
  {
    "code": "MY",
    "nameAr": "ماليزيا",
    "nameEn": "Malaysia",
    "flag": "🇲🇾"
  },
  {
    "code": "MZ",
    "nameAr": "موزمبيق",
    "nameEn": "Mozambique",
    "flag": "🇲🇿"
  },
  {
    "code": "NA",
    "nameAr": "ناميبيا",
    "nameEn": "Namibia",
    "flag": "🇳🇦"
  },
  {
    "code": "NC",
    "nameAr": "كاليدونيا الجديدة",
    "nameEn": "New Caledonia",
    "flag": "🇳🇨"
  },
  {
    "code": "NE",
    "nameAr": "النيجر",
    "nameEn": "Niger",
    "flag": "🇳🇪"
  },
  {
    "code": "NF",
    "nameAr": "جزيرة نورفولك",
    "nameEn": "Norfolk Island",
    "flag": "🇳🇫"
  },
  {
    "code": "NG",
    "nameAr": "نيجيريا",
    "nameEn": "Nigeria",
    "flag": "🇳🇬"
  },
  {
    "code": "NI",
    "nameAr": "نيكاراغوا",
    "nameEn": "Nicaragua",
    "flag": "🇳🇮"
  },
  {
    "code": "NL",
    "nameAr": "هولندا",
    "nameEn": "Netherlands",
    "flag": "🇳🇱"
  },
  {
    "code": "NO",
    "nameAr": "النرويج",
    "nameEn": "Norway",
    "flag": "🇳🇴"
  },
  {
    "code": "NP",
    "nameAr": "نيبال",
    "nameEn": "Nepal",
    "flag": "🇳🇵"
  },
  {
    "code": "NR",
    "nameAr": "ناورو",
    "nameEn": "Nauru",
    "flag": "🇳🇷"
  },
  {
    "code": "NU",
    "nameAr": "نييوي",
    "nameEn": "Niue",
    "flag": "🇳🇺"
  },
  {
    "code": "NZ",
    "nameAr": "نيوزيلندا",
    "nameEn": "New Zealand",
    "flag": "🇳🇿"
  },
  {
    "code": "OM",
    "nameAr": "عمان",
    "nameEn": "Oman",
    "flag": "🇴🇲"
  },
  {
    "code": "PA",
    "nameAr": "بنما",
    "nameEn": "Panama",
    "flag": "🇵🇦"
  },
  {
    "code": "PE",
    "nameAr": "بيرو",
    "nameEn": "Peru",
    "flag": "🇵🇪"
  },
  {
    "code": "PF",
    "nameAr": "بولينزيا الفرنسية",
    "nameEn": "French Polynesia",
    "flag": "🇵🇫"
  },
  {
    "code": "PG",
    "nameAr": "بابوا غينيا الجديدة",
    "nameEn": "Papua New Guinea",
    "flag": "🇵🇬"
  },
  {
    "code": "PH",
    "nameAr": "الفلبين",
    "nameEn": "Philippines",
    "flag": "🇵🇭"
  },
  {
    "code": "PK",
    "nameAr": "باكستان",
    "nameEn": "Pakistan",
    "flag": "🇵🇰"
  },
  {
    "code": "PL",
    "nameAr": "بولندا",
    "nameEn": "Poland",
    "flag": "🇵🇱"
  },
  {
    "code": "PM",
    "nameAr": "سان بيير وميكلون",
    "nameEn": "Saint Pierre and Miquelon",
    "flag": "🇵🇲"
  },
  {
    "code": "PN",
    "nameAr": "جزر بيتكيرن",
    "nameEn": "Pitcairn",
    "flag": "🇵🇳"
  },
  {
    "code": "PR",
    "nameAr": "بورتوريكو",
    "nameEn": "Puerto Rico",
    "flag": "🇵🇷"
  },
  {
    "code": "PS",
    "nameAr": "فلسطين",
    "nameEn": "State of Palestine",
    "flag": "🇵🇸"
  },
  {
    "code": "PT",
    "nameAr": "البرتغال",
    "nameEn": "Portugal",
    "flag": "🇵🇹"
  },
  {
    "code": "PW",
    "nameAr": "بالاو",
    "nameEn": "Palau",
    "flag": "🇵🇼"
  },
  {
    "code": "PY",
    "nameAr": "باراغواي",
    "nameEn": "Paraguay",
    "flag": "🇵🇾"
  },
  {
    "code": "QA",
    "nameAr": "قطر",
    "nameEn": "Qatar",
    "flag": "🇶🇦"
  },
  {
    "code": "RE",
    "nameAr": "لا ريونيون",
    "nameEn": "Reunion",
    "flag": "🇷🇪"
  },
  {
    "code": "RO",
    "nameAr": "رومانيا",
    "nameEn": "Romania",
    "flag": "🇷🇴"
  },
  {
    "code": "RS",
    "nameAr": "صربيا",
    "nameEn": "Serbia",
    "flag": "🇷🇸"
  },
  {
    "code": "RU",
    "nameAr": "روسيا",
    "nameEn": "Russian Federation",
    "flag": "🇷🇺"
  },
  {
    "code": "RW",
    "nameAr": "رواندا",
    "nameEn": "Rwanda",
    "flag": "🇷🇼"
  },
  {
    "code": "SA",
    "nameAr": "السعودية",
    "nameEn": "Saudi Arabia",
    "flag": "🇸🇦"
  },
  {
    "code": "SB",
    "nameAr": "جزر سليمان",
    "nameEn": "Solomon Islands",
    "flag": "🇸🇧"
  },
  {
    "code": "SC",
    "nameAr": "سيشل",
    "nameEn": "Seychelles",
    "flag": "🇸🇨"
  },
  {
    "code": "SD",
    "nameAr": "السودان",
    "nameEn": "Sudan",
    "flag": "🇸🇩"
  },
  {
    "code": "SE",
    "nameAr": "السويد",
    "nameEn": "Sweden",
    "flag": "🇸🇪"
  },
  {
    "code": "SG",
    "nameAr": "سنغافورة",
    "nameEn": "Singapore",
    "flag": "🇸🇬"
  },
  {
    "code": "SH",
    "nameAr": "سانت هيلينا وأسينشين وتريستان دا كونا",
    "nameEn": "Saint Helena",
    "flag": "🇸🇭"
  },
  {
    "code": "SI",
    "nameAr": "سلوفينيا",
    "nameEn": "Slovenia",
    "flag": "🇸🇮"
  },
  {
    "code": "SJ",
    "nameAr": "سفالبارد ويان ماين",
    "nameEn": "Svalbard and Jan Mayen",
    "flag": "🇸🇯"
  },
  {
    "code": "SK",
    "nameAr": "سلوفاكيا",
    "nameEn": "Slovakia",
    "flag": "🇸🇰"
  },
  {
    "code": "SL",
    "nameAr": "سيراليون",
    "nameEn": "Sierra Leone",
    "flag": "🇸🇱"
  },
  {
    "code": "SM",
    "nameAr": "سان مارينو",
    "nameEn": "San Marino",
    "flag": "🇸🇲"
  },
  {
    "code": "SN",
    "nameAr": "السنغال",
    "nameEn": "Senegal",
    "flag": "🇸🇳"
  },
  {
    "code": "SO",
    "nameAr": "الصومال",
    "nameEn": "Somalia",
    "flag": "🇸🇴"
  },
  {
    "code": "SR",
    "nameAr": "سورينام",
    "nameEn": "Suriname",
    "flag": "🇸🇷"
  },
  {
    "code": "SS",
    "nameAr": "جنوب السودان",
    "nameEn": "South Sudan",
    "flag": "🇸🇸"
  },
  {
    "code": "ST",
    "nameAr": "ساو تومي وبرينسيب",
    "nameEn": "Sao Tome and Principe",
    "flag": "🇸🇹"
  },
  {
    "code": "SV",
    "nameAr": "السلفادور",
    "nameEn": "El Salvador",
    "flag": "🇸🇻"
  },
  {
    "code": "SX",
    "nameAr": "سانت مارتن (الجزء الهولندي)",
    "nameEn": "Sint Maarten (Dutch part)",
    "flag": "🇸🇽"
  },
  {
    "code": "SY",
    "nameAr": "سوريا",
    "nameEn": "Syrian Arab Republic",
    "flag": "🇸🇾"
  },
  {
    "code": "SZ",
    "nameAr": "سوازيلاند",
    "nameEn": "Eswatini",
    "flag": "🇸🇿"
  },
  {
    "code": "TC",
    "nameAr": "جزر توركس وكايكوس",
    "nameEn": "Turks and Caicos Islands",
    "flag": "🇹🇨"
  },
  {
    "code": "TD",
    "nameAr": "تشاد",
    "nameEn": "Chad",
    "flag": "🇹🇩"
  },
  {
    "code": "TF",
    "nameAr": "أراض فرنسية جنوبية وأنتارتيكية",
    "nameEn": "French Southern Territories",
    "flag": "🇹🇫"
  },
  {
    "code": "TG",
    "nameAr": "توغو",
    "nameEn": "Togo",
    "flag": "🇹🇬"
  },
  {
    "code": "TH",
    "nameAr": "تايلاند",
    "nameEn": "Thailand",
    "flag": "🇹🇭"
  },
  {
    "code": "TJ",
    "nameAr": "طاجيكستان",
    "nameEn": "Tajikistan",
    "flag": "🇹🇯"
  },
  {
    "code": "TK",
    "nameAr": "توكيلاو",
    "nameEn": "Tokelau",
    "flag": "🇹🇰"
  },
  {
    "code": "TL",
    "nameAr": "تيمور الشرقية",
    "nameEn": "Timor-Leste",
    "flag": "🇹🇱"
  },
  {
    "code": "TM",
    "nameAr": "تركمانستان",
    "nameEn": "Turkmenistan",
    "flag": "🇹🇲"
  },
  {
    "code": "TN",
    "nameAr": "تونس",
    "nameEn": "Tunisia",
    "flag": "🇹🇳"
  },
  {
    "code": "TO",
    "nameAr": "تونغا",
    "nameEn": "Tonga",
    "flag": "🇹🇴"
  },
  {
    "code": "TR",
    "nameAr": "تركيا",
    "nameEn": "Türkiye",
    "flag": "🇹🇷"
  },
  {
    "code": "TT",
    "nameAr": "ترينيداد وتوباغو",
    "nameEn": "Trinidad and Tobago",
    "flag": "🇹🇹"
  },
  {
    "code": "TV",
    "nameAr": "توفالو",
    "nameEn": "Tuvalu",
    "flag": "🇹🇻"
  },
  {
    "code": "TW",
    "nameAr": "تايوان",
    "nameEn": "Taiwan, Province of China",
    "flag": "🇹🇼"
  },
  {
    "code": "TZ",
    "nameAr": "تانزانيا",
    "nameEn": "United Republic of Tanzania",
    "flag": "🇹🇿"
  },
  {
    "code": "UA",
    "nameAr": "أوكرانيا",
    "nameEn": "Ukraine",
    "flag": "🇺🇦"
  },
  {
    "code": "UG",
    "nameAr": "أوغندا",
    "nameEn": "Uganda",
    "flag": "🇺🇬"
  },
  {
    "code": "UM",
    "nameAr": "جزر الولايات المتحدة",
    "nameEn": "United States Minor Outlying Islands",
    "flag": "🇺🇲"
  },
  {
    "code": "US",
    "nameAr": "الولايات المتحدة",
    "nameEn": "United States of America",
    "flag": "🇺🇸"
  },
  {
    "code": "UY",
    "nameAr": "الأوروغواي",
    "nameEn": "Uruguay",
    "flag": "🇺🇾"
  },
  {
    "code": "UZ",
    "nameAr": "أوزبكستان",
    "nameEn": "Uzbekistan",
    "flag": "🇺🇿"
  },
  {
    "code": "VA",
    "nameAr": "الفاتيكان",
    "nameEn": "Holy See (Vatican City State)",
    "flag": "🇻🇦"
  },
  {
    "code": "VC",
    "nameAr": "سانت فينسنت والغرينادين",
    "nameEn": "Saint Vincent and the Grenadines",
    "flag": "🇻🇨"
  },
  {
    "code": "VE",
    "nameAr": "فنزويلا",
    "nameEn": "Venezuela",
    "flag": "🇻🇪"
  },
  {
    "code": "VG",
    "nameAr": "جزر العذراء البريطانية",
    "nameEn": "Virgin Islands, British",
    "flag": "🇻🇬"
  },
  {
    "code": "VI",
    "nameAr": "جزر العذراء الأمريكية",
    "nameEn": "Virgin Islands, U.S.",
    "flag": "🇻🇮"
  },
  {
    "code": "VN",
    "nameAr": "فيتنام",
    "nameEn": "Vietnam",
    "flag": "🇻🇳"
  },
  {
    "code": "VU",
    "nameAr": "فانواتو",
    "nameEn": "Vanuatu",
    "flag": "🇻🇺"
  },
  {
    "code": "WF",
    "nameAr": "والس وفوتونا",
    "nameEn": "Wallis and Futuna",
    "flag": "🇼🇫"
  },
  {
    "code": "WS",
    "nameAr": "ساموا",
    "nameEn": "Samoa",
    "flag": "🇼🇸"
  },
  {
    "code": "YE",
    "nameAr": "اليمن",
    "nameEn": "Yemen",
    "flag": "🇾🇪"
  },
  {
    "code": "YT",
    "nameAr": "مايوت",
    "nameEn": "Mayotte",
    "flag": "🇾🇹"
  },
  {
    "code": "ZA",
    "nameAr": "جنوب أفريقيا",
    "nameEn": "South Africa",
    "flag": "🇿🇦"
  },
  {
    "code": "ZM",
    "nameAr": "زامبيا",
    "nameEn": "Zambia",
    "flag": "🇿🇲"
  },
  {
    "code": "ZW",
    "nameAr": "زيمبابوي",
    "nameEn": "Zimbabwe",
    "flag": "🇿🇼"
  }
];

const COUNTRY_CODES = new Set(COUNTRIES.map((item) => item.code));

module.exports = { COUNTRIES, COUNTRY_CODES };
