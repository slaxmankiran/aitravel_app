import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useLocation, useSearch, Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion, AnimatePresence } from "framer-motion";
import { insertTripSchema, type CreateTripRequest } from "@shared/schema";
import { useCreateTrip } from "@/hooks/use-trips";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Loader2, Plane, Globe, Wallet, Users, ChevronDown, Search, Check, CalendarIcon, ArrowLeft, MapPin, ArrowRight, AlertCircle } from "lucide-react";
import { z } from "zod";
import { format } from "date-fns";
import { DateRange } from "react-day-picker";

// Major world cities for autocomplete
const MAJOR_CITIES = [
  { city: "Tokyo", country: "Japan", code: "JP" },
  { city: "Delhi", country: "India", code: "IN" },
  { city: "Shanghai", country: "China", code: "CN" },
  { city: "São Paulo", country: "Brazil", code: "BR" },
  { city: "Mexico City", country: "Mexico", code: "MX" },
  { city: "Cairo", country: "Egypt", code: "EG" },
  { city: "Mumbai", country: "India", code: "IN" },
  { city: "Beijing", country: "China", code: "CN" },
  { city: "Dhaka", country: "Bangladesh", code: "BD" },
  { city: "Osaka", country: "Japan", code: "JP" },
  { city: "New York", country: "USA", code: "US" },
  { city: "Karachi", country: "Pakistan", code: "PK" },
  { city: "Buenos Aires", country: "Argentina", code: "AR" },
  { city: "Istanbul", country: "Turkey", code: "TR" },
  { city: "Kolkata", country: "India", code: "IN" },
  { city: "Manila", country: "Philippines", code: "PH" },
  { city: "Lagos", country: "Nigeria", code: "NG" },
  { city: "Rio de Janeiro", country: "Brazil", code: "BR" },
  { city: "Tianjin", country: "China", code: "CN" },
  { city: "Kinshasa", country: "DR Congo", code: "CD" },
  { city: "Guangzhou", country: "China", code: "CN" },
  { city: "Los Angeles", country: "USA", code: "US" },
  { city: "Moscow", country: "Russia", code: "RU" },
  { city: "Shenzhen", country: "China", code: "CN" },
  { city: "Lahore", country: "Pakistan", code: "PK" },
  { city: "Bangalore", country: "India", code: "IN" },
  { city: "Paris", country: "France", code: "FR" },
  { city: "Bogotá", country: "Colombia", code: "CO" },
  { city: "Jakarta", country: "Indonesia", code: "ID" },
  { city: "Chennai", country: "India", code: "IN" },
  { city: "Lima", country: "Peru", code: "PE" },
  { city: "Bangkok", country: "Thailand", code: "TH" },
  { city: "Seoul", country: "South Korea", code: "KR" },
  { city: "Nagoya", country: "Japan", code: "JP" },
  { city: "Hyderabad", country: "India", code: "IN" },
  { city: "London", country: "UK", code: "GB" },
  { city: "Tehran", country: "Iran", code: "IR" },
  { city: "Chicago", country: "USA", code: "US" },
  { city: "Chengdu", country: "China", code: "CN" },
  { city: "Nanjing", country: "China", code: "CN" },
  { city: "Wuhan", country: "China", code: "CN" },
  { city: "Ho Chi Minh City", country: "Vietnam", code: "VN" },
  { city: "Luanda", country: "Angola", code: "AO" },
  { city: "Ahmedabad", country: "India", code: "IN" },
  { city: "Kuala Lumpur", country: "Malaysia", code: "MY" },
  { city: "Xi'an", country: "China", code: "CN" },
  { city: "Hong Kong", country: "China", code: "HK" },
  { city: "Dongguan", country: "China", code: "CN" },
  { city: "Hangzhou", country: "China", code: "CN" },
  { city: "Foshan", country: "China", code: "CN" },
  { city: "Shenyang", country: "China", code: "CN" },
  { city: "Riyadh", country: "Saudi Arabia", code: "SA" },
  { city: "Baghdad", country: "Iraq", code: "IQ" },
  { city: "Santiago", country: "Chile", code: "CL" },
  { city: "Surat", country: "India", code: "IN" },
  { city: "Madrid", country: "Spain", code: "ES" },
  { city: "Suzhou", country: "China", code: "CN" },
  { city: "Pune", country: "India", code: "IN" },
  { city: "Harbin", country: "China", code: "CN" },
  { city: "Houston", country: "USA", code: "US" },
  { city: "Dallas", country: "USA", code: "US" },
  { city: "Toronto", country: "Canada", code: "CA" },
  { city: "Dar es Salaam", country: "Tanzania", code: "TZ" },
  { city: "Miami", country: "USA", code: "US" },
  { city: "Belo Horizonte", country: "Brazil", code: "BR" },
  { city: "Singapore", country: "Singapore", code: "SG" },
  { city: "Philadelphia", country: "USA", code: "US" },
  { city: "Atlanta", country: "USA", code: "US" },
  { city: "Fukuoka", country: "Japan", code: "JP" },
  { city: "Khartoum", country: "Sudan", code: "SD" },
  { city: "Barcelona", country: "Spain", code: "ES" },
  { city: "Johannesburg", country: "South Africa", code: "ZA" },
  { city: "Saint Petersburg", country: "Russia", code: "RU" },
  { city: "Qingdao", country: "China", code: "CN" },
  { city: "Dalian", country: "China", code: "CN" },
  { city: "Washington DC", country: "USA", code: "US" },
  { city: "Yangon", country: "Myanmar", code: "MM" },
  { city: "Alexandria", country: "Egypt", code: "EG" },
  { city: "Jinan", country: "China", code: "CN" },
  { city: "Guadalajara", country: "Mexico", code: "MX" },
  { city: "Boston", country: "USA", code: "US" },
  { city: "Phoenix", country: "USA", code: "US" },
  { city: "San Francisco", country: "USA", code: "US" },
  { city: "Seattle", country: "USA", code: "US" },
  { city: "San Diego", country: "USA", code: "US" },
  { city: "Denver", country: "USA", code: "US" },
  { city: "Las Vegas", country: "USA", code: "US" },
  { city: "Detroit", country: "USA", code: "US" },
  { city: "Berlin", country: "Germany", code: "DE" },
  { city: "Rome", country: "Italy", code: "IT" },
  { city: "Milan", country: "Italy", code: "IT" },
  { city: "Naples", country: "Italy", code: "IT" },
  { city: "Amsterdam", country: "Netherlands", code: "NL" },
  { city: "Vienna", country: "Austria", code: "AT" },
  { city: "Prague", country: "Czech Republic", code: "CZ" },
  { city: "Budapest", country: "Hungary", code: "HU" },
  { city: "Warsaw", country: "Poland", code: "PL" },
  { city: "Brussels", country: "Belgium", code: "BE" },
  { city: "Munich", country: "Germany", code: "DE" },
  { city: "Frankfurt", country: "Germany", code: "DE" },
  { city: "Hamburg", country: "Germany", code: "DE" },
  { city: "Zurich", country: "Switzerland", code: "CH" },
  { city: "Geneva", country: "Switzerland", code: "CH" },
  { city: "Copenhagen", country: "Denmark", code: "DK" },
  { city: "Stockholm", country: "Sweden", code: "SE" },
  { city: "Oslo", country: "Norway", code: "NO" },
  { city: "Helsinki", country: "Finland", code: "FI" },
  { city: "Dublin", country: "Ireland", code: "IE" },
  { city: "Lisbon", country: "Portugal", code: "PT" },
  { city: "Athens", country: "Greece", code: "GR" },
  { city: "Dubai", country: "UAE", code: "AE" },
  { city: "Abu Dhabi", country: "UAE", code: "AE" },
  { city: "Doha", country: "Qatar", code: "QA" },
  { city: "Tel Aviv", country: "Israel", code: "IL" },
  { city: "Jerusalem", country: "Israel", code: "IL" },
  { city: "Amman", country: "Jordan", code: "JO" },
  { city: "Beirut", country: "Lebanon", code: "LB" },
  { city: "Kuwait City", country: "Kuwait", code: "KW" },
  { city: "Muscat", country: "Oman", code: "OM" },
  { city: "Cape Town", country: "South Africa", code: "ZA" },
  { city: "Durban", country: "South Africa", code: "ZA" },
  { city: "Nairobi", country: "Kenya", code: "KE" },
  { city: "Addis Ababa", country: "Ethiopia", code: "ET" },
  { city: "Casablanca", country: "Morocco", code: "MA" },
  { city: "Marrakech", country: "Morocco", code: "MA" },
  { city: "Tunis", country: "Tunisia", code: "TN" },
  { city: "Algiers", country: "Algeria", code: "DZ" },
  { city: "Sydney", country: "Australia", code: "AU" },
  { city: "Melbourne", country: "Australia", code: "AU" },
  { city: "Brisbane", country: "Australia", code: "AU" },
  { city: "Perth", country: "Australia", code: "AU" },
  { city: "Auckland", country: "New Zealand", code: "NZ" },
  { city: "Wellington", country: "New Zealand", code: "NZ" },
  { city: "Vancouver", country: "Canada", code: "CA" },
  { city: "Montreal", country: "Canada", code: "CA" },
  { city: "Calgary", country: "Canada", code: "CA" },
  { city: "Ottawa", country: "Canada", code: "CA" },
  { city: "Havana", country: "Cuba", code: "CU" },
  { city: "Panama City", country: "Panama", code: "PA" },
  { city: "San Juan", country: "Puerto Rico", code: "PR" },
  { city: "Cancun", country: "Mexico", code: "MX" },
  { city: "Cartagena", country: "Colombia", code: "CO" },
  { city: "Medellín", country: "Colombia", code: "CO" },
  { city: "Quito", country: "Ecuador", code: "EC" },
  { city: "Cusco", country: "Peru", code: "PE" },
  { city: "Montevideo", country: "Uruguay", code: "UY" },
  { city: "Kyoto", country: "Japan", code: "JP" },
  { city: "Hanoi", country: "Vietnam", code: "VN" },
  { city: "Phuket", country: "Thailand", code: "TH" },
  { city: "Chiang Mai", country: "Thailand", code: "TH" },
  { city: "Bali", country: "Indonesia", code: "ID" },
  { city: "Phnom Penh", country: "Cambodia", code: "KH" },
  { city: "Siem Reap", country: "Cambodia", code: "KH" },
  { city: "Kathmandu", country: "Nepal", code: "NP" },
  { city: "Colombo", country: "Sri Lanka", code: "LK" },
  { city: "Goa", country: "India", code: "IN" },
  { city: "Jaipur", country: "India", code: "IN" },
  { city: "Agra", country: "India", code: "IN" },
  { city: "Varanasi", country: "India", code: "IN" },
  { city: "Udaipur", country: "India", code: "IN" },
  { city: "Nice", country: "France", code: "FR" },
  { city: "Lyon", country: "France", code: "FR" },
  { city: "Marseille", country: "France", code: "FR" },
  { city: "Bordeaux", country: "France", code: "FR" },
  { city: "Florence", country: "Italy", code: "IT" },
  { city: "Venice", country: "Italy", code: "IT" },
  { city: "Santorini", country: "Greece", code: "GR" },
  { city: "Mykonos", country: "Greece", code: "GR" },
  { city: "Reykjavik", country: "Iceland", code: "IS" },
  { city: "Edinburgh", country: "UK", code: "GB" },
  { city: "Manchester", country: "UK", code: "GB" },
  { city: "Liverpool", country: "UK", code: "GB" },
  { city: "Birmingham", country: "UK", code: "GB" },
  { city: "Glasgow", country: "UK", code: "GB" },
].sort((a, b) => a.city.localeCompare(b.city));

// Major currencies
const CURRENCIES = [
  { code: "USD", name: "US Dollar", symbol: "$", flag: "🇺🇸" },
  { code: "EUR", name: "Euro", symbol: "€", flag: "🇪🇺" },
  { code: "GBP", name: "British Pound", symbol: "£", flag: "🇬🇧" },
  { code: "JPY", name: "Japanese Yen", symbol: "¥", flag: "🇯🇵" },
  { code: "CNY", name: "Chinese Yuan", symbol: "¥", flag: "🇨🇳" },
  { code: "INR", name: "Indian Rupee", symbol: "₹", flag: "🇮🇳" },
  { code: "AUD", name: "Australian Dollar", symbol: "A$", flag: "🇦🇺" },
  { code: "CAD", name: "Canadian Dollar", symbol: "C$", flag: "🇨🇦" },
  { code: "CHF", name: "Swiss Franc", symbol: "Fr", flag: "🇨🇭" },
  { code: "KRW", name: "South Korean Won", symbol: "₩", flag: "🇰🇷" },
  { code: "SGD", name: "Singapore Dollar", symbol: "S$", flag: "🇸🇬" },
  { code: "HKD", name: "Hong Kong Dollar", symbol: "HK$", flag: "🇭🇰" },
  { code: "NZD", name: "New Zealand Dollar", symbol: "NZ$", flag: "🇳🇿" },
  { code: "SEK", name: "Swedish Krona", symbol: "kr", flag: "🇸🇪" },
  { code: "NOK", name: "Norwegian Krone", symbol: "kr", flag: "🇳🇴" },
  { code: "DKK", name: "Danish Krone", symbol: "kr", flag: "🇩🇰" },
  { code: "MXN", name: "Mexican Peso", symbol: "$", flag: "🇲🇽" },
  { code: "BRL", name: "Brazilian Real", symbol: "R$", flag: "🇧🇷" },
  { code: "AED", name: "UAE Dirham", symbol: "د.إ", flag: "🇦🇪" },
  { code: "SAR", name: "Saudi Riyal", symbol: "﷼", flag: "🇸🇦" },
  { code: "THB", name: "Thai Baht", symbol: "฿", flag: "🇹🇭" },
  { code: "MYR", name: "Malaysian Ringgit", symbol: "RM", flag: "🇲🇾" },
  { code: "IDR", name: "Indonesian Rupiah", symbol: "Rp", flag: "🇮🇩" },
  { code: "PHP", name: "Philippine Peso", symbol: "₱", flag: "🇵🇭" },
  { code: "ZAR", name: "South African Rand", symbol: "R", flag: "🇿🇦" },
  { code: "TRY", name: "Turkish Lira", symbol: "₺", flag: "🇹🇷" },
  { code: "RUB", name: "Russian Ruble", symbol: "₽", flag: "🇷🇺" },
  { code: "PLN", name: "Polish Zloty", symbol: "zł", flag: "🇵🇱" },
  { code: "CZK", name: "Czech Koruna", symbol: "Kč", flag: "🇨🇿" },
  { code: "HUF", name: "Hungarian Forint", symbol: "Ft", flag: "🇭🇺" },
];

// Complete list of countries with flag emojis
const COUNTRIES = [
  { code: "AF", name: "Afghanistan", flag: "🇦🇫" },
  { code: "AL", name: "Albania", flag: "🇦🇱" },
  { code: "DZ", name: "Algeria", flag: "🇩🇿" },
  { code: "AD", name: "Andorra", flag: "🇦🇩" },
  { code: "AO", name: "Angola", flag: "🇦🇴" },
  { code: "AG", name: "Antigua and Barbuda", flag: "🇦🇬" },
  { code: "AR", name: "Argentina", flag: "🇦🇷" },
  { code: "AM", name: "Armenia", flag: "🇦🇲" },
  { code: "AU", name: "Australia", flag: "🇦🇺" },
  { code: "AT", name: "Austria", flag: "🇦🇹" },
  { code: "AZ", name: "Azerbaijan", flag: "🇦🇿" },
  { code: "BS", name: "Bahamas", flag: "🇧🇸" },
  { code: "BH", name: "Bahrain", flag: "🇧🇭" },
  { code: "BD", name: "Bangladesh", flag: "🇧🇩" },
  { code: "BB", name: "Barbados", flag: "🇧🇧" },
  { code: "BY", name: "Belarus", flag: "🇧🇾" },
  { code: "BE", name: "Belgium", flag: "🇧🇪" },
  { code: "BZ", name: "Belize", flag: "🇧🇿" },
  { code: "BJ", name: "Benin", flag: "🇧🇯" },
  { code: "BT", name: "Bhutan", flag: "🇧🇹" },
  { code: "BO", name: "Bolivia", flag: "🇧🇴" },
  { code: "BA", name: "Bosnia and Herzegovina", flag: "🇧🇦" },
  { code: "BW", name: "Botswana", flag: "🇧🇼" },
  { code: "BR", name: "Brazil", flag: "🇧🇷" },
  { code: "BN", name: "Brunei", flag: "🇧🇳" },
  { code: "BG", name: "Bulgaria", flag: "🇧🇬" },
  { code: "BF", name: "Burkina Faso", flag: "🇧🇫" },
  { code: "BI", name: "Burundi", flag: "🇧🇮" },
  { code: "CV", name: "Cabo Verde", flag: "🇨🇻" },
  { code: "KH", name: "Cambodia", flag: "🇰🇭" },
  { code: "CM", name: "Cameroon", flag: "🇨🇲" },
  { code: "CA", name: "Canada", flag: "🇨🇦" },
  { code: "CF", name: "Central African Republic", flag: "🇨🇫" },
  { code: "TD", name: "Chad", flag: "🇹🇩" },
  { code: "CL", name: "Chile", flag: "🇨🇱" },
  { code: "CN", name: "China", flag: "🇨🇳" },
  { code: "CO", name: "Colombia", flag: "🇨🇴" },
  { code: "KM", name: "Comoros", flag: "🇰🇲" },
  { code: "CG", name: "Congo", flag: "🇨🇬" },
  { code: "CR", name: "Costa Rica", flag: "🇨🇷" },
  { code: "HR", name: "Croatia", flag: "🇭🇷" },
  { code: "CU", name: "Cuba", flag: "🇨🇺" },
  { code: "CY", name: "Cyprus", flag: "🇨🇾" },
  { code: "CZ", name: "Czech Republic", flag: "🇨🇿" },
  { code: "DK", name: "Denmark", flag: "🇩🇰" },
  { code: "DJ", name: "Djibouti", flag: "🇩🇯" },
  { code: "DM", name: "Dominica", flag: "🇩🇲" },
  { code: "DO", name: "Dominican Republic", flag: "🇩🇴" },
  { code: "EC", name: "Ecuador", flag: "🇪🇨" },
  { code: "EG", name: "Egypt", flag: "🇪🇬" },
  { code: "SV", name: "El Salvador", flag: "🇸🇻" },
  { code: "GQ", name: "Equatorial Guinea", flag: "🇬🇶" },
  { code: "ER", name: "Eritrea", flag: "🇪🇷" },
  { code: "EE", name: "Estonia", flag: "🇪🇪" },
  { code: "SZ", name: "Eswatini", flag: "🇸🇿" },
  { code: "ET", name: "Ethiopia", flag: "🇪🇹" },
  { code: "FJ", name: "Fiji", flag: "🇫🇯" },
  { code: "FI", name: "Finland", flag: "🇫🇮" },
  { code: "FR", name: "France", flag: "🇫🇷" },
  { code: "GA", name: "Gabon", flag: "🇬🇦" },
  { code: "GM", name: "Gambia", flag: "🇬🇲" },
  { code: "GE", name: "Georgia", flag: "🇬🇪" },
  { code: "DE", name: "Germany", flag: "🇩🇪" },
  { code: "GH", name: "Ghana", flag: "🇬🇭" },
  { code: "GR", name: "Greece", flag: "🇬🇷" },
  { code: "GD", name: "Grenada", flag: "🇬🇩" },
  { code: "GT", name: "Guatemala", flag: "🇬🇹" },
  { code: "GN", name: "Guinea", flag: "🇬🇳" },
  { code: "GW", name: "Guinea-Bissau", flag: "🇬🇼" },
  { code: "GY", name: "Guyana", flag: "🇬🇾" },
  { code: "HT", name: "Haiti", flag: "🇭🇹" },
  { code: "HN", name: "Honduras", flag: "🇭🇳" },
  { code: "HU", name: "Hungary", flag: "🇭🇺" },
  { code: "IS", name: "Iceland", flag: "🇮🇸" },
  { code: "IN", name: "India", flag: "🇮🇳" },
  { code: "ID", name: "Indonesia", flag: "🇮🇩" },
  { code: "IR", name: "Iran", flag: "🇮🇷" },
  { code: "IQ", name: "Iraq", flag: "🇮🇶" },
  { code: "IE", name: "Ireland", flag: "🇮🇪" },
  { code: "IL", name: "Israel", flag: "🇮🇱" },
  { code: "IT", name: "Italy", flag: "🇮🇹" },
  { code: "JM", name: "Jamaica", flag: "🇯🇲" },
  { code: "JP", name: "Japan", flag: "🇯🇵" },
  { code: "JO", name: "Jordan", flag: "🇯🇴" },
  { code: "KZ", name: "Kazakhstan", flag: "🇰🇿" },
  { code: "KE", name: "Kenya", flag: "🇰🇪" },
  { code: "KI", name: "Kiribati", flag: "🇰🇮" },
  { code: "KP", name: "North Korea", flag: "🇰🇵" },
  { code: "KR", name: "South Korea", flag: "🇰🇷" },
  { code: "KW", name: "Kuwait", flag: "🇰🇼" },
  { code: "KG", name: "Kyrgyzstan", flag: "🇰🇬" },
  { code: "LA", name: "Laos", flag: "🇱🇦" },
  { code: "LV", name: "Latvia", flag: "🇱🇻" },
  { code: "LB", name: "Lebanon", flag: "🇱🇧" },
  { code: "LS", name: "Lesotho", flag: "🇱🇸" },
  { code: "LR", name: "Liberia", flag: "🇱🇷" },
  { code: "LY", name: "Libya", flag: "🇱🇾" },
  { code: "LI", name: "Liechtenstein", flag: "🇱🇮" },
  { code: "LT", name: "Lithuania", flag: "🇱🇹" },
  { code: "LU", name: "Luxembourg", flag: "🇱🇺" },
  { code: "MG", name: "Madagascar", flag: "🇲🇬" },
  { code: "MW", name: "Malawi", flag: "🇲🇼" },
  { code: "MY", name: "Malaysia", flag: "🇲🇾" },
  { code: "MV", name: "Maldives", flag: "🇲🇻" },
  { code: "ML", name: "Mali", flag: "🇲🇱" },
  { code: "MT", name: "Malta", flag: "🇲🇹" },
  { code: "MH", name: "Marshall Islands", flag: "🇲🇭" },
  { code: "MR", name: "Mauritania", flag: "🇲🇷" },
  { code: "MU", name: "Mauritius", flag: "🇲🇺" },
  { code: "MX", name: "Mexico", flag: "🇲🇽" },
  { code: "FM", name: "Micronesia", flag: "🇫🇲" },
  { code: "MD", name: "Moldova", flag: "🇲🇩" },
  { code: "MC", name: "Monaco", flag: "🇲🇨" },
  { code: "MN", name: "Mongolia", flag: "🇲🇳" },
  { code: "ME", name: "Montenegro", flag: "🇲🇪" },
  { code: "MA", name: "Morocco", flag: "🇲🇦" },
  { code: "MZ", name: "Mozambique", flag: "🇲🇿" },
  { code: "MM", name: "Myanmar", flag: "🇲🇲" },
  { code: "NA", name: "Namibia", flag: "🇳🇦" },
  { code: "NR", name: "Nauru", flag: "🇳🇷" },
  { code: "NP", name: "Nepal", flag: "🇳🇵" },
  { code: "NL", name: "Netherlands", flag: "🇳🇱" },
  { code: "NZ", name: "New Zealand", flag: "🇳🇿" },
  { code: "NI", name: "Nicaragua", flag: "🇳🇮" },
  { code: "NE", name: "Niger", flag: "🇳🇪" },
  { code: "NG", name: "Nigeria", flag: "🇳🇬" },
  { code: "MK", name: "North Macedonia", flag: "🇲🇰" },
  { code: "NO", name: "Norway", flag: "🇳🇴" },
  { code: "OM", name: "Oman", flag: "🇴🇲" },
  { code: "PK", name: "Pakistan", flag: "🇵🇰" },
  { code: "PW", name: "Palau", flag: "🇵🇼" },
  { code: "PS", name: "Palestine", flag: "🇵🇸" },
  { code: "PA", name: "Panama", flag: "🇵🇦" },
  { code: "PG", name: "Papua New Guinea", flag: "🇵🇬" },
  { code: "PY", name: "Paraguay", flag: "🇵🇾" },
  { code: "PE", name: "Peru", flag: "🇵🇪" },
  { code: "PH", name: "Philippines", flag: "🇵🇭" },
  { code: "PL", name: "Poland", flag: "🇵🇱" },
  { code: "PT", name: "Portugal", flag: "🇵🇹" },
  { code: "QA", name: "Qatar", flag: "🇶🇦" },
  { code: "RO", name: "Romania", flag: "🇷🇴" },
  { code: "RU", name: "Russia", flag: "🇷🇺" },
  { code: "RW", name: "Rwanda", flag: "🇷🇼" },
  { code: "KN", name: "Saint Kitts and Nevis", flag: "🇰🇳" },
  { code: "LC", name: "Saint Lucia", flag: "🇱🇨" },
  { code: "VC", name: "Saint Vincent and the Grenadines", flag: "🇻🇨" },
  { code: "WS", name: "Samoa", flag: "🇼🇸" },
  { code: "SM", name: "San Marino", flag: "🇸🇲" },
  { code: "ST", name: "Sao Tome and Principe", flag: "🇸🇹" },
  { code: "SA", name: "Saudi Arabia", flag: "🇸🇦" },
  { code: "SN", name: "Senegal", flag: "🇸🇳" },
  { code: "RS", name: "Serbia", flag: "🇷🇸" },
  { code: "SC", name: "Seychelles", flag: "🇸🇨" },
  { code: "SL", name: "Sierra Leone", flag: "🇸🇱" },
  { code: "SG", name: "Singapore", flag: "🇸🇬" },
  { code: "SK", name: "Slovakia", flag: "🇸🇰" },
  { code: "SI", name: "Slovenia", flag: "🇸🇮" },
  { code: "SB", name: "Solomon Islands", flag: "🇸🇧" },
  { code: "SO", name: "Somalia", flag: "🇸🇴" },
  { code: "ZA", name: "South Africa", flag: "🇿🇦" },
  { code: "SS", name: "South Sudan", flag: "🇸🇸" },
  { code: "ES", name: "Spain", flag: "🇪🇸" },
  { code: "LK", name: "Sri Lanka", flag: "🇱🇰" },
  { code: "SD", name: "Sudan", flag: "🇸🇩" },
  { code: "SR", name: "Suriname", flag: "🇸🇷" },
  { code: "SE", name: "Sweden", flag: "🇸🇪" },
  { code: "CH", name: "Switzerland", flag: "🇨🇭" },
  { code: "SY", name: "Syria", flag: "🇸🇾" },
  { code: "TW", name: "Taiwan", flag: "🇹🇼" },
  { code: "TJ", name: "Tajikistan", flag: "🇹🇯" },
  { code: "TZ", name: "Tanzania", flag: "🇹🇿" },
  { code: "TH", name: "Thailand", flag: "🇹🇭" },
  { code: "TL", name: "Timor-Leste", flag: "🇹🇱" },
  { code: "TG", name: "Togo", flag: "🇹🇬" },
  { code: "TO", name: "Tonga", flag: "🇹🇴" },
  { code: "TT", name: "Trinidad and Tobago", flag: "🇹🇹" },
  { code: "TN", name: "Tunisia", flag: "🇹🇳" },
  { code: "TR", name: "Turkey", flag: "🇹🇷" },
  { code: "TM", name: "Turkmenistan", flag: "🇹🇲" },
  { code: "TV", name: "Tuvalu", flag: "🇹🇻" },
  { code: "UG", name: "Uganda", flag: "🇺🇬" },
  { code: "UA", name: "Ukraine", flag: "🇺🇦" },
  { code: "AE", name: "United Arab Emirates", flag: "🇦🇪" },
  { code: "GB", name: "United Kingdom", flag: "🇬🇧" },
  { code: "US", name: "United States", flag: "🇺🇸" },
  { code: "UY", name: "Uruguay", flag: "🇺🇾" },
  { code: "UZ", name: "Uzbekistan", flag: "🇺🇿" },
  { code: "VU", name: "Vanuatu", flag: "🇻🇺" },
  { code: "VA", name: "Vatican City", flag: "🇻🇦" },
  { code: "VE", name: "Venezuela", flag: "🇻🇪" },
  { code: "VN", name: "Vietnam", flag: "🇻🇳" },
  { code: "YE", name: "Yemen", flag: "🇾🇪" },
  { code: "ZM", name: "Zambia", flag: "🇿🇲" },
  { code: "ZW", name: "Zimbabwe", flag: "🇿🇼" },
];

// Splitting the schema for steps
const step1Schema = insertTripSchema.pick({ passport: true, residence: true });
const step2Schema = insertTripSchema.pick({ origin: true, destination: true, dates: true });
// Travel style options with budget multipliers and visual details
const TRAVEL_STYLES = [
  {
    value: 'budget',
    label: 'Budget',
    icon: '🎒',
    color: 'emerald',
    tagline: 'Smart & Savvy',
    features: ['Hostels & budget hotels', 'Street food & local eats', 'Public transport', 'Free attractions'],
    multiplier: 0.6
  },
  {
    value: 'standard',
    label: 'Comfort',
    icon: '🧳',
    color: 'blue',
    tagline: 'Best of Both',
    features: ['3-4 star hotels', 'Local restaurants', 'Mix of transport', 'Popular attractions'],
    multiplier: 1.0
  },
  {
    value: 'luxury',
    label: 'Luxury',
    icon: '✨',
    color: 'amber',
    tagline: 'Premium Experience',
    features: ['5-star resorts', 'Fine dining', 'Private transfers', 'VIP experiences'],
    multiplier: 2.5
  },
  {
    value: 'custom',
    label: 'Custom',
    icon: '⚙️',
    color: 'slate',
    tagline: 'Set Your Own',
    features: ['Enter your exact budget', 'Full control', 'Any travel style'],
    multiplier: 1.0
  },
] as const;

type TravelStyleValue = 'budget' | 'standard' | 'luxury' | 'custom';

// Custom step3 schema that treats empty/NaN children/infants as 0
// Budget is only required when travelStyle is 'custom'
const step3Schema = z.object({
  travelStyle: z.enum(['budget', 'standard', 'luxury', 'custom']).default('standard'),
  budget: z.preprocess((val) => {
    // Convert undefined/null/NaN to 1 (placeholder for non-custom styles)
    if (val === "" || val === null || val === undefined || Number.isNaN(val)) return 1;
    return Number(val);
  }, z.number().min(0).default(1)),
  groupSize: z.number().min(1).default(1),
  adults: z.number().min(1, "At least 1 adult is required").default(1),
  children: z.preprocess((val) => {
    if (val === "" || val === null || val === undefined || Number.isNaN(val)) return 0;
    return Number(val);
  }, z.number().min(0).default(0)),
  infants: z.preprocess((val) => {
    if (val === "" || val === null || val === undefined || Number.isNaN(val)) return 0;
    return Number(val);
  }, z.number().min(0).default(0)),
}).refine((data) => {
  // Only require budget >= 1 when travelStyle is 'custom'
  if (data.travelStyle === 'custom' && data.budget < 1) {
    return false;
  }
  return true;
}, {
  message: "Budget is required for custom travel style",
  path: ["budget"],
});

// Detect if origin and destination are in the same country/region for domestic pricing
function isDomesticTravel(origin: string, destination: string): boolean {
  const o = origin.toLowerCase();
  const d = destination.toLowerCase();

  // India domestic
  const indianCities = ['india', 'delhi', 'mumbai', 'bangalore', 'bengaluru', 'hyderabad', 'chennai', 'kolkata', 'goa', 'jaipur', 'agra', 'kerala', 'pune', 'ahmedabad', 'lucknow', 'chandigarh', 'kochi', 'thiruvananthapuram', 'varanasi', 'udaipur', 'jodhpur', 'amritsar', 'shimla', 'manali', 'rishikesh', 'darjeeling', 'gangtok', 'leh', 'srinagar', 'mysore', 'hampi', 'ooty', 'munnar', 'alleppey', 'coorg', 'pondicherry'];
  if (indianCities.some(c => o.includes(c)) && indianCities.some(c => d.includes(c))) return true;

  // Thailand domestic
  const thaiCities = ['thailand', 'bangkok', 'phuket', 'chiang mai', 'pattaya', 'krabi', 'koh samui', 'koh phangan', 'koh tao', 'ayutthaya', 'sukhothai'];
  if (thaiCities.some(c => o.includes(c)) && thaiCities.some(c => d.includes(c))) return true;

  // Vietnam domestic
  const vietnamCities = ['vietnam', 'hanoi', 'ho chi minh', 'saigon', 'da nang', 'hoi an', 'nha trang', 'hue', 'sapa', 'halong'];
  if (vietnamCities.some(c => o.includes(c)) && vietnamCities.some(c => d.includes(c))) return true;

  // Indonesia domestic
  const indonesiaCities = ['indonesia', 'bali', 'jakarta', 'yogyakarta', 'lombok', 'ubud', 'denpasar', 'surabaya', 'bandung'];
  if (indonesiaCities.some(c => o.includes(c)) && indonesiaCities.some(c => d.includes(c))) return true;

  return false;
}

// Detect South Asia region for very affordable pricing
function isSouthAsiaDestination(destination: string): boolean {
  const d = destination.toLowerCase();
  const southAsiaCities = ['india', 'delhi', 'mumbai', 'bangalore', 'bengaluru', 'hyderabad', 'chennai', 'kolkata', 'goa', 'jaipur', 'agra', 'kerala', 'pune', 'nepal', 'kathmandu', 'pokhara', 'sri lanka', 'colombo', 'bangladesh', 'dhaka', 'pakistan', 'karachi', 'lahore'];
  return southAsiaCities.some(c => d.includes(c));
}

// Minimum budget per person per day (USD equivalent) by destination type
// These are realistic estimates including accommodation, food, local transport, activities
const BUDGET_MINIMUMS = {
  // South Asia domestic - extremely affordable (₹800-1200/day)
  southAsiaDomestic: {
    perPersonPerDay: 10,   // ~₹830/day for budget travel
    transportCost: 12,     // ~₹1000 for train/bus round trip
    destinations: [] as string[]  // Detected via isDomesticTravel
  },
  // South Asia international - still affordable
  southAsiaInternational: {
    perPersonPerDay: 25,   // ~₹2000/day including better hotels
    transportCost: 150,    // Budget flights from abroad
    destinations: [] as string[]
  },
  veryExpensive: {
    perPersonPerDay: 250,  // Reduced from 350 - budget-conscious estimate
    flightCost: 1200,      // Reduced from 1400
    destinations: [
      // Luxury island destinations
      'maldives', 'seychelles', 'fiji', 'bora bora', 'tahiti', 'mauritius',
      // Greek islands (peak season)
      'santorini', 'mykonos',
      // Expensive European countries
      'switzerland', 'zurich', 'geneva', 'lucerne', 'interlaken',
      'norway', 'oslo', 'bergen', 'tromso',
      'iceland', 'reykjavik',
      'monaco', 'monte carlo',
      // Scandinavian capitals
      'copenhagen', 'stockholm', 'helsinki',
      // Other luxury destinations
      'bermuda', 'cayman islands', 'virgin islands', 'st. barts', 'turks and caicos'
    ]
  },
  expensive: {
    perPersonPerDay: 150,  // Reduced from 220 - budget traveler estimate
    flightCost: 900,       // Reduced from 1100
    destinations: [
      // Western Europe
      'france', 'paris', 'nice', 'cannes', 'lyon',
      'united kingdom', 'uk', 'england', 'london', 'edinburgh', 'scotland',
      'ireland', 'dublin',
      'netherlands', 'amsterdam', 'rotterdam',
      'belgium', 'brussels', 'bruges',
      'austria', 'vienna', 'salzburg',
      'germany', 'munich', 'frankfurt', 'berlin',
      // Southern Europe
      'italy', 'rome', 'venice', 'florence', 'milan', 'naples', 'amalfi',
      'greece', 'athens', 'crete',
      // North America expensive cities
      'new york', 'nyc', 'manhattan', 'san francisco', 'los angeles', 'la', 'hawaii', 'honolulu', 'maui',
      'boston', 'chicago', 'seattle', 'washington dc',
      // Asia Pacific expensive
      'japan', 'tokyo', 'kyoto', 'osaka',
      'singapore',
      'hong kong',
      'australia', 'sydney', 'melbourne', 'perth', 'brisbane',
      'new zealand', 'auckland', 'queenstown', 'wellington',
      // Middle East
      'dubai', 'abu dhabi', 'uae', 'emirates', 'qatar', 'doha',
      'israel', 'tel aviv', 'jerusalem'
    ]
  },
  moderate: {
    perPersonPerDay: 100,  // Reduced from 130
    flightCost: 600,       // Reduced from 750
    destinations: [
      // Southern/Eastern Europe
      'spain', 'barcelona', 'madrid', 'seville', 'valencia', 'malaga',
      'portugal', 'lisbon', 'porto',
      'czech', 'prague',
      'hungary', 'budapest',
      'poland', 'warsaw', 'krakow',
      'croatia', 'dubrovnik', 'split', 'zagreb',
      'slovenia', 'ljubljana',
      'slovakia', 'bratislava',
      'romania', 'bucharest',
      'bulgaria', 'sofia',
      'baltic', 'estonia', 'tallinn', 'latvia', 'riga', 'lithuania', 'vilnius',
      // North America moderate
      'canada', 'toronto', 'vancouver', 'montreal', 'calgary',
      'usa', 'america', 'united states', 'miami', 'orlando', 'las vegas', 'denver', 'phoenix', 'dallas', 'atlanta',
      'mexico city',
      // Asia moderate
      'south korea', 'korea', 'seoul', 'busan',
      'taiwan', 'taipei',
      'china', 'beijing', 'shanghai', 'guangzhou', 'shenzhen', 'hong kong',
      // South America moderate
      'brazil', 'rio', 'sao paulo',
      'chile', 'santiago',
      'argentina', 'buenos aires',
      // Africa moderate
      'south africa', 'cape town', 'johannesburg',
      'kenya', 'nairobi'
    ]
  },
  budget: {
    perPersonPerDay: 50,   // Reduced from 80 - backpacker/budget estimate
    flightCost: 350,       // Reduced from 450
    destinations: [
      // Southeast Asia
      'thailand', 'bangkok', 'phuket', 'chiang mai', 'pattaya', 'krabi',
      'vietnam', 'hanoi', 'ho chi minh', 'saigon', 'da nang', 'hoi an',
      'indonesia', 'bali', 'jakarta', 'yogyakarta', 'lombok',
      'philippines', 'manila', 'cebu', 'boracay', 'palawan',
      'cambodia', 'siem reap', 'phnom penh',
      'laos', 'vientiane', 'luang prabang',
      'myanmar', 'yangon',
      'malaysia', 'kuala lumpur', 'penang', 'langkawi',
      // South Asia
      'india', 'delhi', 'mumbai', 'goa', 'jaipur', 'agra', 'kerala', 'bangalore', 'hyderabad', 'chennai', 'kolkata',
      'nepal', 'kathmandu', 'pokhara',
      'sri lanka', 'colombo',
      'bangladesh', 'dhaka',
      'pakistan', 'karachi', 'lahore',
      // Central America & Caribbean budget
      'mexico', 'cancun', 'playa del carmen', 'tulum', 'puerto vallarta', 'oaxaca',
      'guatemala', 'costa rica', 'panama', 'nicaragua', 'honduras', 'el salvador', 'belize',
      'cuba', 'havana', 'dominican republic', 'punta cana', 'jamaica',
      // South America budget
      'colombia', 'bogota', 'medellin', 'cartagena',
      'peru', 'lima', 'cusco', 'machu picchu',
      'ecuador', 'quito',
      'bolivia', 'la paz',
      // Middle East & North Africa budget
      'turkey', 'istanbul', 'antalya', 'cappadocia', 'bodrum',
      'egypt', 'cairo', 'luxor', 'sharm el sheikh', 'hurghada',
      'morocco', 'marrakech', 'fes', 'casablanca',
      'jordan', 'amman', 'petra',
      'tunisia', 'oman',
      // Eastern Europe budget
      'ukraine', 'kyiv', 'georgia', 'tbilisi', 'armenia', 'yerevan', 'azerbaijan', 'baku',
      // Africa budget
      'tanzania', 'zanzibar', 'ethiopia', 'addis ababa', 'ghana', 'accra', 'senegal', 'dakar', 'uganda', 'rwanda'
    ]
  },
  default: { perPersonPerDay: 100, flightCost: 600 }  // Reduced defaults
};

// Calculate minimum realistic budget including transport
function calculateMinimumBudget(origin: string, destination: string, numDays: number, adults: number, children: number, infants: number): number {
  const destLower = destination.toLowerCase();

  let perPersonPerDay = BUDGET_MINIMUMS.default.perPersonPerDay;
  let transportCostPerAdult = BUDGET_MINIMUMS.default.flightCost;

  // Priority 1: Check for domestic travel in affordable regions
  const isDomestic = isDomesticTravel(origin, destination);
  const isSouthAsia = isSouthAsiaDestination(destination);

  if (isDomestic && isSouthAsia) {
    // South Asia domestic - very affordable (₹800-1200/day total)
    perPersonPerDay = BUDGET_MINIMUMS.southAsiaDomestic.perPersonPerDay;
    transportCostPerAdult = BUDGET_MINIMUMS.southAsiaDomestic.transportCost;
  } else if (isSouthAsia) {
    // Coming to South Asia from abroad
    perPersonPerDay = BUDGET_MINIMUMS.southAsiaInternational.perPersonPerDay;
    transportCostPerAdult = BUDGET_MINIMUMS.southAsiaInternational.transportCost;
  } else if (BUDGET_MINIMUMS.veryExpensive.destinations.some(d => destLower.includes(d))) {
    perPersonPerDay = BUDGET_MINIMUMS.veryExpensive.perPersonPerDay;
    transportCostPerAdult = BUDGET_MINIMUMS.veryExpensive.flightCost;
  } else if (BUDGET_MINIMUMS.expensive.destinations.some(d => destLower.includes(d))) {
    perPersonPerDay = BUDGET_MINIMUMS.expensive.perPersonPerDay;
    transportCostPerAdult = BUDGET_MINIMUMS.expensive.flightCost;
  } else if (BUDGET_MINIMUMS.moderate.destinations.some(d => destLower.includes(d))) {
    perPersonPerDay = BUDGET_MINIMUMS.moderate.perPersonPerDay;
    transportCostPerAdult = BUDGET_MINIMUMS.moderate.flightCost;
  } else if (BUDGET_MINIMUMS.budget.destinations.some(d => destLower.includes(d))) {
    perPersonPerDay = BUDGET_MINIMUMS.budget.perPersonPerDay;
    transportCostPerAdult = BUDGET_MINIMUMS.budget.flightCost;
  }

  // Adults: full cost, Children: 70%, Infants: 20%
  const adultDailyCost = adults * perPersonPerDay * numDays;
  const childDailyCost = children * perPersonPerDay * 0.7 * numDays;
  const infantDailyCost = infants * perPersonPerDay * 0.2 * numDays;

  // Transport costs: Adults full price, Children 75%, Infants 10%
  const adultTransportCost = adults * transportCostPerAdult;
  const childTransportCost = children * transportCostPerAdult * 0.75;
  const infantTransportCost = infants * transportCostPerAdult * 0.1;

  const totalDailyCosts = adultDailyCost + childDailyCost + infantDailyCost;
  const totalTransportCosts = adultTransportCost + childTransportCost + infantTransportCost;

  return Math.round(totalDailyCosts + totalTransportCosts);
}

// Parse date range to get number of days
function getNumDaysFromDateString(dates: string): number {
  if (!dates) return 7;
  const parts = dates.split(' - ');
  if (parts.length !== 2) return 7;
  try {
    const from = new Date(parts[0]);
    const to = new Date(parts[1]);
    return Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  } catch {
    return 7;
  }
}

// Check if dates are in the past
function areDatesInPast(dates: string): boolean {
  if (!dates) return false;
  const parts = dates.split(' - ');
  if (parts.length === 0) return false;
  try {
    const from = new Date(parts[0]);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return from < today;
  } catch {
    return false;
  }
}

type Step1Data = z.infer<typeof step1Schema>;
type Step2Data = z.infer<typeof step2Schema>;
type Step3Data = z.infer<typeof step3Schema>;

// Searchable Country Dropdown Component
function CountrySelect({
  value,
  onChange,
  placeholder = "Select country...",
  label
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const filteredCountries = useMemo(() => {
    if (!search) return COUNTRIES;
    return COUNTRIES.filter(c =>
      c.name.toLowerCase().includes(search.toLowerCase())
    );
  }, [search]);

  const selectedCountry = COUNTRIES.find(c => c.name === value);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full h-12 px-3 text-left bg-white border border-slate-200 rounded-md flex items-center justify-between hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
      >
        <div className="flex items-center gap-2">
          <Globe className="h-5 w-5 text-slate-400" />
          {selectedCountry ? (
            <span className="flex items-center gap-2">
              <span className="text-xl">{selectedCountry.flag}</span>
              <span>{selectedCountry.name}</span>
            </span>
          ) : (
            <span className="text-slate-400">{placeholder}</span>
          )}
        </div>
        <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden"
          >
            {/* Search Input */}
            <div className="p-2 border-b border-slate-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search countries..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  autoFocus
                />
              </div>
            </div>

            {/* Country List */}
            <div className="max-h-60 overflow-y-auto">
              {filteredCountries.length === 0 ? (
                <div className="p-4 text-center text-slate-500 text-sm">No countries found</div>
              ) : (
                filteredCountries.map((country) => (
                  <button
                    key={country.code}
                    type="button"
                    onClick={() => {
                      onChange(country.name);
                      setIsOpen(false);
                      setSearch("");
                    }}
                    className={`w-full px-3 py-2.5 text-left flex items-center gap-3 hover:bg-slate-50 transition-colors ${
                      value === country.name ? 'bg-primary/5' : ''
                    }`}
                  >
                    <span className="text-xl">{country.flag}</span>
                    <span className="flex-grow">{country.name}</span>
                    {value === country.name && (
                      <Check className="h-4 w-4 text-primary" />
                    )}
                  </button>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// City Autocomplete Component - Hybrid: Local + Nominatim API
interface NominatimResult {
  city: string;
  country: string;
  code: string;
  displayName: string;
  source: 'local' | 'api';
}

function CityAutocomplete({
  value,
  onChange,
  placeholder = "Start typing a city..."
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState(value || "");
  const [apiResults, setApiResults] = useState<NominatimResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fast local filtering (instant)
  const localResults = useMemo(() => {
    if (!search || search.length < 2) return [];
    const searchLower = search.toLowerCase();
    return MAJOR_CITIES.filter(c =>
      c.city.toLowerCase().includes(searchLower) ||
      c.country.toLowerCase().includes(searchLower)
    ).slice(0, 8).map(c => ({
      city: c.city,
      country: c.country,
      code: c.code,
      displayName: `${c.city}, ${c.country}`,
      source: 'local' as const
    }));
  }, [search]);

  // Merge local and API results, deduplicating by display name
  const allResults = useMemo(() => {
    const localNames = new Set(localResults.map(r => r.displayName.toLowerCase()));
    const uniqueApiResults = apiResults.filter(
      r => !localNames.has(r.displayName.toLowerCase())
    );
    return [...localResults, ...uniqueApiResults].slice(0, 10);
  }, [localResults, apiResults]);

  // Nominatim API search (debounced, for unknown cities)
  const searchNominatim = useCallback(async (query: string) => {
    if (query.length < 3) return;

    // Only search API if local results are insufficient
    const localCount = MAJOR_CITIES.filter(c =>
      c.city.toLowerCase().includes(query.toLowerCase()) ||
      c.country.toLowerCase().includes(query.toLowerCase())
    ).length;

    if (localCount >= 5) {
      setApiResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&featuretype=city&addressdetails=1`,
        {
          headers: { 'User-Agent': 'VoyageAI Travel Planner' }
        }
      );

      if (response.ok) {
        const data = await response.json();
        const results: NominatimResult[] = data
          .filter((item: any) => item.address?.city || item.address?.town || item.address?.village || item.name)
          .map((item: any) => {
            const cityName = item.address?.city || item.address?.town || item.address?.village || item.name;
            const country = item.address?.country || '';
            const countryCode = item.address?.country_code?.toUpperCase() || '';
            return {
              city: cityName,
              country,
              code: countryCode,
              displayName: `${cityName}, ${country}`,
              source: 'api' as const
            };
          })
          .filter((r: NominatimResult) => r.city && r.country);

        setApiResults(results);
      }
    } catch (error) {
      console.log('Nominatim search failed:', error);
      setApiResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Update search when value changes from outside (e.g., URL param)
  useEffect(() => {
    if (value && value !== search) {
      setSearch(value);
    }
  }, [value]);

  // Debounced API search
  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (search.length >= 3) {
      searchTimeoutRef.current = setTimeout(() => {
        searchNominatim(search);
      }, 300); // 300ms debounce
    } else {
      setApiResults([]);
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [search, searchNominatim]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setSearch(newValue);
    onChange(newValue);
    setIsOpen(newValue.length >= 2);
  };

  const handleCitySelect = (result: NominatimResult) => {
    setSearch(result.displayName);
    onChange(result.displayName);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={handleInputChange}
          onFocus={() => search.length >= 2 && setIsOpen(true)}
          placeholder={placeholder}
          className="w-full h-12 pl-10 pr-3 bg-white border border-slate-200 rounded-md hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
        />
        {isSearching && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary animate-spin" />
        )}
      </div>

      <AnimatePresence>
        {isOpen && (allResults.length > 0 || isSearching) && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden"
          >
            <div className="max-h-60 overflow-y-auto">
              {allResults.map((result, idx) => (
                <button
                  key={`${result.city}-${result.country}-${idx}`}
                  type="button"
                  onClick={() => handleCitySelect(result)}
                  className="w-full px-3 py-3 text-left flex items-center gap-3 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0"
                >
                  <MapPin className={`h-4 w-4 flex-shrink-0 ${result.source === 'api' ? 'text-emerald-500' : 'text-slate-400'}`} />
                  <div className="flex-1">
                    <span className="font-medium">{result.city}</span>
                    <span className="text-slate-500">, {result.country}</span>
                    {result.source === 'api' && (
                      <span className="ml-2 text-xs text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">Dynamic</span>
                    )}
                  </div>
                </button>
              ))}
              {isSearching && allResults.length === 0 && (
                <div className="px-4 py-3 text-center text-slate-500 text-sm flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Searching cities worldwide...
                </div>
              )}
            </div>
            <div className="px-3 py-2 bg-slate-50 border-t border-slate-100 text-xs text-slate-500">
              {apiResults.length > 0
                ? "💡 Search any city worldwide"
                : "Type 3+ characters to search more cities"}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Currency Selector Component
function CurrencySelect({
  value,
  onChange,
  placeholder = "Select currency..."
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const filteredCurrencies = useMemo(() => {
    if (!search) return CURRENCIES;
    return CURRENCIES.filter(c =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.code.toLowerCase().includes(search.toLowerCase())
    );
  }, [search]);

  const selectedCurrency = CURRENCIES.find(c => c.code === value);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full h-12 px-3 text-left bg-white border border-slate-200 rounded-md flex items-center justify-between hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
      >
        <div className="flex items-center gap-2">
          {selectedCurrency ? (
            <span className="flex items-center gap-2">
              <span className="text-xl">{selectedCurrency.flag}</span>
              <span>{selectedCurrency.code} - {selectedCurrency.name}</span>
            </span>
          ) : (
            <span className="text-slate-400">{placeholder}</span>
          )}
        </div>
        <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl overflow-hidden"
          >
            {/* Search Input */}
            <div className="p-2 border-b border-slate-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search currencies..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  autoFocus
                />
              </div>
            </div>

            {/* Currency List */}
            <div className="max-h-60 overflow-y-auto">
              {filteredCurrencies.length === 0 ? (
                <div className="p-4 text-center text-slate-500 text-sm">No currencies found</div>
              ) : (
                filteredCurrencies.map((currency) => (
                  <button
                    key={currency.code}
                    type="button"
                    onClick={() => {
                      onChange(currency.code);
                      setIsOpen(false);
                      setSearch("");
                    }}
                    className={`w-full px-3 py-2.5 text-left flex items-center gap-3 hover:bg-slate-50 transition-colors ${
                      value === currency.code ? 'bg-primary/5' : ''
                    }`}
                  >
                    <span className="text-xl">{currency.flag}</span>
                    <div className="flex-grow">
                      <span className="font-medium">{currency.code}</span>
                      <span className="text-slate-500 ml-2">{currency.name}</span>
                    </div>
                    <span className="text-slate-400">{currency.symbol}</span>
                    {value === currency.code && (
                      <Check className="h-4 w-4 text-primary" />
                    )}
                  </button>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function CreateTrip() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();

  // Parse URL parameters
  const urlParams = new URLSearchParams(searchString);
  const urlDestination = urlParams.get("destination");
  const isEditMode = urlParams.get("edit") !== null;

  // Get all edit parameters
  const editData = isEditMode ? {
    passport: urlParams.get("passport") || "",
    origin: urlParams.get("origin") || "",
    destination: urlParams.get("destination") || "",
    dates: urlParams.get("dates") || "",
    budget: urlParams.get("budget") ? Number(urlParams.get("budget")) : undefined,
    currency: urlParams.get("currency") || "USD",
    adults: urlParams.get("adults") ? Number(urlParams.get("adults")) : 1,
    children: urlParams.get("children") ? Number(urlParams.get("children")) : 0,
    infants: urlParams.get("infants") ? Number(urlParams.get("infants")) : 0,
  } : null;

  // Initialize state - URL params take priority over sessionStorage
  const [step, setStep] = useState(() => {
    // If editing a trip, start at step 1 with all data pre-filled
    if (isEditMode) {
      sessionStorage.removeItem('createTrip_step');
      sessionStorage.removeItem('createTrip_formData');
      return 1;
    }
    // If coming from "Explore Destinations" with a URL param, start fresh at step 1
    if (urlDestination) {
      sessionStorage.removeItem('createTrip_step');
      sessionStorage.removeItem('createTrip_formData');
      return 1;
    }
    const saved = sessionStorage.getItem('createTrip_step');
    return saved ? parseInt(saved, 10) : 1;
  });

  const [formData, setFormData] = useState<Partial<CreateTripRequest>>(() => {
    // If editing a trip, use all the edit data
    if (isEditMode && editData) {
      return {
        passport: editData.passport,
        residence: editData.origin, // Use origin as residence
        origin: editData.origin,
        destination: editData.destination,
        dates: editData.dates,
        budget: editData.budget,
        currency: editData.currency,
        adults: editData.adults,
        children: editData.children,
        infants: editData.infants,
        groupSize: editData.adults + editData.children + editData.infants,
      };
    }
    // If URL has destination only (from explore page), use it
    if (urlDestination) {
      return { destination: urlDestination };
    }
    const saved = sessionStorage.getItem('createTrip_formData');
    return saved ? JSON.parse(saved) : {};
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const createTrip = useCreateTrip();

  // Persist step to sessionStorage
  useEffect(() => {
    sessionStorage.setItem('createTrip_step', step.toString());
  }, [step]);

  // Persist formData to sessionStorage
  useEffect(() => {
    sessionStorage.setItem('createTrip_formData', JSON.stringify(formData));
  }, [formData]);

  // PRELOAD DESTINATION IMAGE: Start fetching as soon as user enters destination
  // This ensures the image is cached and ready when they reach the TripDetails page
  useEffect(() => {
    const destination = formData.destination;
    if (!destination || destination.length < 3) return;

    // Debounce the API call to avoid too many requests while typing
    const timer = setTimeout(() => {
      console.log(`[Preload] Starting AI image fetch for: ${destination}`);
      fetch(`/api/destination-image?destination=${encodeURIComponent(destination)}`)
        .then(res => res.json())
        .then(data => {
          if (data.imageUrl) {
            console.log(`[Preload] Cached image for ${destination}: ${data.landmark}`);
            // Preload the actual image into browser cache
            const img = new Image();
            img.src = data.imageUrl;
          }
        })
        .catch(err => console.log('[Preload] Image prefetch failed:', err));
    }, 500); // 500ms debounce

    return () => clearTimeout(timer);
  }, [formData.destination]);

  // Clear sessionStorage on successful submission (will be called from handleNext)
  const clearFormStorage = () => {
    sessionStorage.removeItem('createTrip_step');
    sessionStorage.removeItem('createTrip_formData');
  };

  const handleNext = (data: any) => {
    console.log("handleNext called with data:", data, "current step:", step);

    const updatedData = { ...formData, ...data };
    setFormData(updatedData);

    if (step < 3) {
      setStep(step + 1);
    } else {
      // Prevent double submission
      if (isSubmitting || createTrip.isPending) {
        console.log("Already submitting, ignoring");
        return;
      }

      setIsSubmitting(true);

      // Final submission
      console.log("Submitting trip data:", updatedData);
      createTrip.mutate(updatedData as CreateTripRequest, {
        onSuccess: (response) => {
          console.log("Trip created successfully:", response);
          clearFormStorage(); // Clear saved form data on success
          setLocation(`/trips/${response.id}`);
        },
        onError: (error) => {
          console.error("Trip creation failed:", error);
          setIsSubmitting(false);
          alert("Failed to create trip: " + error.message);
        }
      });
    }
  };

  return (
    <div className="min-h-screen relative flex flex-col items-center justify-center p-4 overflow-hidden">
      {/* Clean Navigation - No border */}
      <nav className="fixed top-0 w-full z-50 bg-black/10 backdrop-blur-sm">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/">
            <div className="flex items-center gap-2 cursor-pointer group">
              <div className="w-8 h-8 rounded-lg bg-white/20 backdrop-blur-md flex items-center justify-center text-white font-bold font-display shadow-lg group-hover:bg-white/30 transition-colors">
                V
              </div>
              <span className="font-display font-semibold text-lg tracking-tight text-white/90 group-hover:text-white transition-colors">VoyageAI</span>
            </div>
          </Link>
        </div>
      </nav>

      {/* Stunning Timelapse Video Background */}
      <div className="absolute inset-0 overflow-hidden">
        <video
          autoPlay
          muted
          loop
          playsInline
          className="absolute w-full h-full object-cover"
          poster="https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&q=80"
        >
          {/* Stunning aerial timelapse - mountains and clouds */}
          <source src="https://videos.pexels.com/video-files/3571264/3571264-uhd_2560_1440_30fps.mp4" type="video/mp4" />
        </video>
        {/* Reduced overlay for brighter background */}
        <div className="absolute inset-0 bg-black/15" />
      </div>

      <div className="w-full max-w-lg relative z-10">
        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between text-xs font-semibold uppercase tracking-wider text-white/70 mb-2">
            <span className={step >= 1 ? "text-cyan-300" : ""}>Profile</span>
            <span className={step >= 2 ? "text-cyan-300" : ""}>Destination</span>
            <span className={step >= 3 ? "text-cyan-300" : ""}>Budget</span>
          </div>
          <div className="h-2 bg-white/20 rounded-full overflow-hidden backdrop-blur-sm">
            <motion.div
              className="h-full bg-gradient-to-r from-cyan-400 to-primary"
              initial={{ width: "33%" }}
              animate={{ width: `${(step / 3) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>

        <Card className="shadow-2xl border-0 overflow-hidden backdrop-blur-xl bg-white/95 rounded-2xl">
          <div className="bg-gradient-to-r from-slate-800 to-slate-900 p-5 text-white">
            <h2 className="text-xl font-display font-bold">
              {step === 1 && "Traveler Profile"}
              {step === 2 && "Trip Details"}
              {step === 3 && "Budget & Travelers"}
            </h2>
            <p className="text-slate-400 text-sm mt-1">
              {step === 1 && "Tell us about your citizenship for visa checks."}
              {step === 2 && "Where and when do you want to go?"}
              {step === 3 && "Set your budget and group size for the perfect trip."}
            </p>
          </div>
          
          <CardContent className="p-6 pt-8">
            <AnimatePresence mode="wait">
              {step === 1 && (
                <Step1Form 
                  key="step1" 
                  defaultValues={formData as Step1Data} 
                  onSubmit={handleNext} 
                />
              )}
              {step === 2 && (
                <Step2Form 
                  key="step2" 
                  defaultValues={formData as Step2Data} 
                  onBack={() => setStep(1)} 
                  onSubmit={handleNext} 
                />
              )}
              {step === 3 && (
                <Step3Form
                  key="step3"
                  defaultValues={formData as Step3Data}
                  onBack={() => setStep(2)}
                  onSubmit={handleNext}
                  isLoading={isSubmitting || createTrip.isPending}
                  origin={(formData as any).origin}
                  destination={(formData as any).destination}
                  dates={(formData as any).dates}
                />
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Step1Form({ defaultValues, onSubmit }: { defaultValues: Step1Data, onSubmit: (data: Step1Data) => void }) {
  const form = useForm<Step1Data>({
    resolver: zodResolver(step1Schema),
    defaultValues: defaultValues || { passport: "", residence: "" }
  });

  const passportValue = form.watch("passport");
  const residenceValue = form.watch("residence");

  return (
    <motion.form
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      onSubmit={form.handleSubmit(onSubmit)}
      className="space-y-6"
    >
      <div className="space-y-2">
        <Label htmlFor="passport">Nationality</Label>
        <CountrySelect
          value={passportValue}
          onChange={(value) => form.setValue("passport", value)}
          placeholder="Select your nationality..."
        />
        {form.formState.errors.passport && <p className="text-destructive text-sm">{form.formState.errors.passport.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="residence">Current Residence (Optional)</Label>
        <CountrySelect
          value={residenceValue || ""}
          onChange={(value) => form.setValue("residence", value)}
          placeholder="Select country of residence..."
        />
        <p className="text-xs text-muted-foreground">Used to check for visa exemptions based on residence permits.</p>
      </div>

      <div className="pt-4 flex gap-4">
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="flex-1"
          onClick={() => {
            sessionStorage.removeItem('createTrip_step');
            sessionStorage.removeItem('createTrip_formData');
            window.location.href = '/';
          }}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Home
        </Button>
        <Button type="submit" size="lg" className="flex-1">Next Step</Button>
      </div>
    </motion.form>
  );
}

function Step2Form({ defaultValues, onBack, onSubmit }: { defaultValues: Step2Data, onBack: () => void, onSubmit: (data: Step2Data) => void }) {
  const form = useForm<Step2Data>({
    resolver: zodResolver(step2Schema),
    defaultValues: defaultValues || { origin: "", destination: "", dates: "" }
  });

  // Parse existing dates string to restore DateRange
  const parseDateRange = (datesStr: string): DateRange | undefined => {
    if (!datesStr) return undefined;
    try {
      const parts = datesStr.split(" - ");
      if (parts.length >= 1) {
        const from = new Date(parts[0]);
        const to = parts.length > 1 ? new Date(parts[1]) : undefined;
        if (!isNaN(from.getTime())) {
          return { from, to: to && !isNaN(to.getTime()) ? to : undefined };
        }
      }
    } catch {
      return undefined;
    }
    return undefined;
  };

  const [dateRange, setDateRange] = useState<DateRange | undefined>(() =>
    parseDateRange(defaultValues?.dates || "")
  );
  const [calendarOpen, setCalendarOpen] = useState(false);

  // Update form values when defaultValues change (e.g., from URL params or navigating back)
  useEffect(() => {
    if (defaultValues?.destination) {
      form.setValue("destination", defaultValues.destination);
    }
    if (defaultValues?.dates) {
      form.setValue("dates", defaultValues.dates);
      // Also restore the dateRange state
      const parsed = parseDateRange(defaultValues.dates);
      if (parsed) {
        setDateRange(parsed);
      }
    }
  }, [defaultValues, form]);

  // Update dates field when date range changes
  useEffect(() => {
    if (dateRange?.from) {
      const fromStr = format(dateRange.from, "MMM d, yyyy");
      const toStr = dateRange.to ? format(dateRange.to, "MMM d, yyyy") : "";
      const datesString = toStr ? `${fromStr} - ${toStr}` : fromStr;
      form.setValue("dates", datesString);
    }
  }, [dateRange, form]);

  const [dateError, setDateError] = useState<string | null>(null);
  const [dateWarning, setDateWarning] = useState<string | null>(null);

  // Calculate trip duration for display
  const tripDuration = dateRange?.from && dateRange?.to
    ? Math.ceil((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24)) + 1
    : 0;

  // Custom submit handler with date validation
  const handleSubmit = (data: Step2Data) => {
    // Validate dates are not in the past
    if (areDatesInPast(data.dates)) {
      setDateError("Travel dates must be in the future. Please select upcoming dates.");
      setDateWarning(null);
      return;
    }
    // Validate end date is selected
    if (!dateRange?.to) {
      setDateError("Please select both start and end dates for your trip.");
      setDateWarning(null);
      return;
    }

    // Calculate trip duration (dateRange.from is guaranteed to exist if dateRange.to exists)
    const duration = Math.ceil((dateRange.to.getTime() - dateRange.from!.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    // Block extremely unrealistic trips (60+ days)
    if (duration > 60) {
      setDateError(`A ${duration}-day trip is too long for detailed planning. Please select 60 days or less.`);
      setDateWarning(null);
      return;
    }

    // Warn for very long trips (21-60 days) but allow proceeding
    if (duration > 21) {
      setDateWarning(`${duration} days is a long trip! The AI will generate a varied itinerary, but consider breaking it into multiple shorter trips for better planning.`);
    } else {
      setDateWarning(null);
    }

    setDateError(null);
    onSubmit(data);
  };

  return (
    <motion.form
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      onSubmit={form.handleSubmit(handleSubmit)}
      className="space-y-6"
    >
      <div className="space-y-2">
        <Label htmlFor="origin">Departing From</Label>
        <CityAutocomplete
          value={form.watch("origin") || ""}
          onChange={(value) => form.setValue("origin", value)}
          placeholder="Your departure city (e.g. New York, London)..."
        />
        <p className="text-xs text-muted-foreground">Used to estimate travel costs for your trip.</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="destination">Destination</Label>
        <CityAutocomplete
          value={form.watch("destination")}
          onChange={(value) => form.setValue("destination", value)}
          placeholder="Start typing a city (e.g. Paris, Tokyo)..."
        />
        {form.formState.errors.destination && <p className="text-destructive text-sm">{form.formState.errors.destination.message}</p>}
      </div>

      <div className="space-y-2">
        <Label>Travel Dates</Label>
        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="w-full h-12 justify-start text-left font-normal"
            >
              <CalendarIcon className="mr-2 h-4 w-4 text-slate-400" />
              {dateRange?.from ? (
                dateRange.to ? (
                  <span>
                    {format(dateRange.from, "MMM d, yyyy")} - {format(dateRange.to, "MMM d, yyyy")}
                  </span>
                ) : (
                  format(dateRange.from, "MMM d, yyyy")
                )
              ) : (
                <span className="text-slate-400">Select your travel dates</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              defaultMonth={dateRange?.from}
              selected={dateRange}
              onSelect={(range) => {
                // If a complete range exists and user clicks a new date,
                // start fresh selection from that date
                if (dateRange?.from && dateRange?.to && range?.from && !range?.to) {
                  setDateRange({ from: range.from, to: undefined });
                } else {
                  setDateRange(range);
                }
              }}
              numberOfMonths={2}
              disabled={(date) => date < new Date()}
            />
            <div className="p-3 border-t flex justify-between">
              {dateRange?.from && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setDateRange(undefined)}
                  className="text-slate-500 hover:text-slate-700"
                >
                  Clear dates
                </Button>
              )}
              <div className="flex-1" />
              <Button
                type="button"
                size="sm"
                onClick={() => setCalendarOpen(false)}
              >
                Done
              </Button>
            </div>
          </PopoverContent>
        </Popover>
        <input type="hidden" {...form.register("dates")} />
        {form.formState.errors.dates && <p className="text-destructive text-sm">{form.formState.errors.dates.message}</p>}
        {/* Trip duration display */}
        {tripDuration > 0 && (
          <p className={`text-sm ${tripDuration > 21 ? 'text-amber-600' : 'text-muted-foreground'}`}>
            {tripDuration} day{tripDuration > 1 ? 's' : ''} trip
            {tripDuration > 14 && tripDuration <= 21 && ' (extended trip)'}
            {tripDuration > 21 && tripDuration <= 60 && ' (very long trip)'}
          </p>
        )}
        {dateError && (
          <p className="text-destructive text-sm flex items-center gap-1">
            <span className="inline-block w-4 h-4 rounded-full bg-destructive/20 text-destructive text-xs flex items-center justify-center">!</span>
            {dateError}
          </p>
        )}
        {dateWarning && !dateError && (
          <p className="text-amber-600 text-sm flex items-center gap-1 bg-amber-50 p-2 rounded-lg">
            <span className="inline-block w-4 h-4 rounded-full bg-amber-100 text-amber-600 text-xs flex items-center justify-center">!</span>
            {dateWarning}
          </p>
        )}
      </div>

      <div className="pt-4 flex gap-4">
        <Button type="button" variant="outline" onClick={onBack} size="lg" className="flex-1">Back</Button>
        <Button type="submit" size="lg" className="flex-1">Next Step</Button>
      </div>
    </motion.form>
  );
}

function Step3Form({ defaultValues, onBack, onSubmit, isLoading, origin, destination, dates }: {
  defaultValues: Step3Data & { currency?: string },
  origin: string,
  onBack: () => void,
  onSubmit: (data: Step3Data & { currency: string }) => void,
  isLoading: boolean,
  destination?: string,
  dates?: string
}) {
  const form = useForm<Step3Data>({
    resolver: zodResolver(step3Schema),
    defaultValues: defaultValues || { travelStyle: 'standard', budget: 2000, groupSize: 1, adults: 1, children: 0, infants: 0 }
  });

  const [currency, setCurrency] = useState(defaultValues?.currency || "USD");
  const selectedCurrency = CURRENCIES.find(c => c.code === currency);
  const [budgetError, setBudgetError] = useState<string | null>(null);
  const [budgetWarning, setBudgetWarning] = useState<string | null>(null);
  const [liveRates, setLiveRates] = useState<Record<string, number> | null>(null);
  const [travelStyle, setTravelStyle] = useState<TravelStyleValue>(
    (defaultValues?.travelStyle as TravelStyleValue) || 'standard'
  );
  const [showCustomBudget, setShowCustomBudget] = useState(defaultValues?.travelStyle === 'custom');

  // Fetch live exchange rates on mount (using free API)
  useEffect(() => {
    const fetchRates = async () => {
      try {
        // Using exchangerate-api.com free tier (or fallback to frankfurter.app)
        const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
        if (response.ok) {
          const data = await response.json();
          setLiveRates(data.rates);
          console.log('[Currency] Loaded live exchange rates');
        }
      } catch (error) {
        console.log('[Currency] Using fallback rates');
        // Use fallback static rates if API fails
      }
    };
    fetchRates();
  }, []);

  // Get exchange rate (live or fallback)
  const getExchangeRate = (code: string): number => {
    if (liveRates && liveRates[code]) {
      return liveRates[code];
    }
    // Fallback rates
    const fallbackRates: Record<string, number> = {
      USD: 1, EUR: 0.92, GBP: 0.79, INR: 83, JPY: 150, AUD: 1.55,
      CAD: 1.36, SGD: 1.35, AED: 3.67, THB: 35, CNY: 7.2, KRW: 1320,
      MXN: 17, BRL: 5, CHF: 0.88, SEK: 10.5, NZD: 1.65, HKD: 7.8
    };
    return fallbackRates[code] || 1;
  };

  // Handle currency change with conversion
  const handleCurrencyChange = (newCurrency: string) => {
    const currentBudget = form.getValues("budget");
    if (currentBudget && currentBudget > 0) {
      // Convert: current -> USD -> new currency
      const currentRate = getExchangeRate(currency);
      const newRate = getExchangeRate(newCurrency);
      const usdAmount = currentBudget / currentRate;
      let convertedAmount = usdAmount * newRate;

      // Round to nearest sensible value based on amount
      if (convertedAmount >= 100000) {
        convertedAmount = Math.round(convertedAmount / 10000) * 10000; // Round to nearest 10,000
      } else if (convertedAmount >= 10000) {
        convertedAmount = Math.round(convertedAmount / 1000) * 1000; // Round to nearest 1,000
      } else if (convertedAmount >= 1000) {
        convertedAmount = Math.round(convertedAmount / 100) * 100; // Round to nearest 100
      } else {
        convertedAmount = Math.round(convertedAmount / 10) * 10; // Round to nearest 10
      }

      form.setValue("budget", convertedAmount);
    }
    setCurrency(newCurrency);
  };

  // Watch traveler counts to calculate total (handle NaN from empty inputs)
  const rawAdults = form.watch("adults");
  const rawChildren = form.watch("children");
  const rawInfants = form.watch("infants");
  const rawBudget = form.watch("budget");

  const adults = (typeof rawAdults === 'number' && !Number.isNaN(rawAdults)) ? rawAdults : 1;
  const children = (typeof rawChildren === 'number' && !Number.isNaN(rawChildren)) ? rawChildren : 0;
  const infants = (typeof rawInfants === 'number' && !Number.isNaN(rawInfants)) ? rawInfants : 0;
  const budget = (typeof rawBudget === 'number' && !Number.isNaN(rawBudget)) ? rawBudget : 0;
  const totalTravelers = adults + children + infants;

  // Calculate minimum budget based on origin, destination, duration, and travelers
  const numDays = getNumDaysFromDateString(dates || "");
  const minimumBudget = useMemo(() => {
    return calculateMinimumBudget(origin || "", destination || "", numDays, adults, children, infants);
  }, [origin, destination, numDays, adults, children, infants]);

  // Update groupSize when traveler counts change
  useEffect(() => {
    form.setValue("groupSize", totalTravelers);
  }, [adults, children, infants, totalTravelers, form]);

  // Validate budget in real-time - ONLY for Custom budget (not Budget/Standard/Luxury)
  useEffect(() => {
    // Only validate when Custom is selected - AI handles Budget/Standard/Luxury automatically
    if (!showCustomBudget) {
      setBudgetError(null);
      setBudgetWarning(null);
      return;
    }

    if (budget > 0 && minimumBudget > 0) {
      // Convert minimumBudget to selected currency using live rates
      const multiplier = getExchangeRate(currency);
      const minInCurrency = Math.round(minimumBudget * multiplier);

      if (budget < minInCurrency * 0.5) {
        setBudgetError(`Budget too low. Minimum realistic budget for ${totalTravelers} traveler${totalTravelers > 1 ? 's' : ''} for ${numDays} days is approximately ${selectedCurrency?.symbol}${minInCurrency.toLocaleString()}`);
        setBudgetWarning(null);
      } else if (budget < minInCurrency * 0.8) {
        setBudgetWarning(`This budget is tight. Recommended minimum: ${selectedCurrency?.symbol}${minInCurrency.toLocaleString()} for ${totalTravelers} traveler${totalTravelers > 1 ? 's' : ''}`);
        setBudgetError(null);
      } else {
        setBudgetError(null);
        setBudgetWarning(null);
      }
    }
  }, [budget, minimumBudget, currency, selectedCurrency, totalTravelers, numDays, showCustomBudget]);

  // Custom submit handler that includes currency
  const handleFormSubmit = (data: Step3Data) => {
    // Block submission only for Custom if budget is way too low
    // Budget/Standard/Luxury don't need validation - AI handles costs
    if (showCustomBudget && budgetError) {
      return;
    }
    onSubmit({ ...data, currency });
  };

  return (
    <motion.form
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      onSubmit={form.handleSubmit(handleFormSubmit)}
      className="space-y-6"
    >
      {/* Travelers Section - First */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-slate-400" />
          <Label className="text-base font-medium">Travelers ({totalTravelers} total)</Label>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {/* Adults */}
          <div className="space-y-1.5">
            <Label htmlFor="adults" className="text-sm text-slate-600">Adults (12+)</Label>
            <Input
              id="adults"
              type="number"
              min="1"
              max="20"
              className="h-11 text-center"
              {...form.register("adults", { valueAsNumber: true })}
            />
          </div>

          {/* Children - Optional */}
          <div className="space-y-1.5">
            <Label htmlFor="children" className="text-sm text-slate-500">
              Children (2-11)
              <span className="text-xs text-slate-400 ml-1 font-normal">optional</span>
            </Label>
            <Input
              id="children"
              type="number"
              min="0"
              max="20"
              placeholder="0"
              className="h-11 text-center bg-slate-50/50 border-dashed"
              {...form.register("children", { valueAsNumber: true })}
            />
          </div>

          {/* Infants - Optional */}
          <div className="space-y-1.5">
            <Label htmlFor="infants" className="text-sm text-slate-500">
              Infants (0-2)
              <span className="text-xs text-slate-400 ml-1 font-normal">optional</span>
            </Label>
            <Input
              id="infants"
              type="number"
              min="0"
              max="10"
              placeholder="0"
              className="h-11 text-center bg-slate-50/50 border-dashed"
              {...form.register("infants", { valueAsNumber: true })}
            />
          </div>
        </div>

        <p className="text-xs text-muted-foreground">Children and infants are optional. Add only if traveling with kids - they often get discounted rates.</p>

        {/* Hidden field for groupSize */}
        <input type="hidden" {...form.register("groupSize", { valueAsNumber: true })} />
      </div>

      {/* Travel Style & Budget Section - Combined for better UX */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-base font-medium">Travel Style & Budget</Label>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Currency:</span>
            <select
              value={currency}
              onChange={(e) => handleCurrencyChange(e.target.value)}
              className="h-8 pl-2 pr-6 text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg appearance-none cursor-pointer hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.flag} {c.code}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Travel Style Cards - 2x2 Grid - No upfront budget estimates */}
        <div className="grid grid-cols-2 gap-3">
          {TRAVEL_STYLES.map((style) => {
            const isSelected = travelStyle === style.value;

            // Color classes based on style
            const colorClasses = {
              emerald: { border: 'border-emerald-500', bg: 'bg-emerald-50', text: 'text-emerald-700', badge: 'bg-emerald-100 text-emerald-700' },
              blue: { border: 'border-blue-500', bg: 'bg-blue-50', text: 'text-blue-700', badge: 'bg-blue-100 text-blue-700' },
              amber: { border: 'border-amber-500', bg: 'bg-amber-50', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-700' },
              slate: { border: 'border-slate-500', bg: 'bg-slate-50', text: 'text-slate-700', badge: 'bg-slate-100 text-slate-700' },
            }[style.color];

            return (
              <motion.button
                key={style.value}
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  setTravelStyle(style.value as TravelStyleValue);
                  form.setValue('travelStyle', style.value as TravelStyleValue);

                  if (style.value === 'custom') {
                    setShowCustomBudget(true);
                  } else {
                    setShowCustomBudget(false);
                    // Set a placeholder budget - AI will calculate realistic costs based on travel style
                    // This is just a marker; actual costs are determined by AI based on destination + style
                    form.setValue('budget', 1); // Minimal placeholder, AI calculates actual costs
                  }
                }}
                className={`relative p-4 rounded-xl border-2 transition-all text-left ${
                  isSelected
                    ? `${colorClasses?.border} ${colorClasses?.bg} shadow-lg`
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                }`}
              >
                {/* Selected indicator */}
                {isSelected && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className={`absolute -top-2 -right-2 w-6 h-6 rounded-full ${colorClasses?.badge} flex items-center justify-center shadow-sm`}
                  >
                    <Check className="w-3.5 h-3.5" />
                  </motion.div>
                )}

                <div className="flex items-start gap-3">
                  <div className="text-2xl">{style.icon}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`font-semibold ${isSelected ? colorClasses?.text : 'text-slate-800'}`}>
                        {style.label}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${isSelected ? colorClasses?.badge : 'bg-slate-100 text-slate-500'}`}>
                        {style.tagline}
                      </span>
                    </div>

                    {/* Features list - no budget estimate shown */}
                    <ul className="mt-2 space-y-0.5">
                      {style.features.slice(0, 3).map((feature, idx) => (
                        <li key={idx} className="text-xs text-slate-500 flex items-center gap-1">
                          <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* Custom Budget Input - Only shown when Custom is selected */}
        <AnimatePresence>
          {showCustomBudget && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <Label htmlFor="budget" className="text-sm font-medium">
                  Enter Your Total Budget for {totalTravelers} Traveler{totalTravelers > 1 ? 's' : ''} ({numDays} days)
                </Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-semibold">
                      {selectedCurrency?.symbol || '$'}
                    </div>
                    <Input
                      id="budget"
                      type="number"
                      placeholder="Enter your budget"
                      className="pl-8 h-12 text-lg font-semibold bg-white"
                      {...form.register("budget", { valueAsNumber: true })}
                    />
                  </div>
                </div>
                <p className="text-xs text-slate-500">
                  AI will create a realistic itinerary that fits your budget. If budget is tight, it will suggest cheaper alternatives like free activities, budget stays, or shorter trips.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Budget/Standard/Luxury - AI handles costs silently, no message needed */}

        {/* Hidden input for non-custom styles to ensure budget is submitted */}
        {!showCustomBudget && (
          <input type="hidden" {...form.register("budget", { valueAsNumber: true })} />
        )}

        {/* Validation Messages */}
        {form.formState.errors.budget && (
          <p className="text-destructive text-sm">{form.formState.errors.budget.message}</p>
        )}
        {budgetError && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2"
          >
            <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
            <p className="text-red-700 text-sm">{budgetError}</p>
          </motion.div>
        )}
        {budgetWarning && !budgetError && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2"
          >
            <AlertCircle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
            <p className="text-amber-700 text-sm">{budgetWarning}</p>
          </motion.div>
        )}
      </div>

      <div className="pt-4 flex gap-4">
        <Button type="button" variant="outline" onClick={onBack} size="lg" className="flex-1" disabled={isLoading}>Back</Button>
        <Button type="submit" size="lg" variant="gradient" className="flex-[2]" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Planning...
            </>
          ) : (
            "Plan My Trip"
          )}
        </Button>
      </div>
    </motion.form>
  );
}
