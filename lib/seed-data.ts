import type { Category, Product, Store } from "@/types";

export const categories: Category[] = [
  { id: "smartphones", name: "Smartphones", slug: "smartphones", icon: "phone", accent: "#d9f5ec" },
  { id: "laptops", name: "Laptops", slug: "laptops", icon: "laptop", accent: "#e3ebff" },
  { id: "audio", name: "Audio", slug: "audio", icon: "headphones", accent: "#fff0d5" },
  { id: "televisions", name: "TVs", slug: "televisions", icon: "tv", accent: "#f9e2e5" },
  { id: "cameras", name: "Cameras", slug: "cameras", icon: "camera", accent: "#e8e0f8" },
  { id: "gaming", name: "Gaming", slug: "gaming", icon: "gamepad", accent: "#e0f2f8" },
  { id: "smartwatches", name: "Smartwatches", slug: "smartwatches", icon: "watch", accent: "#f4e8d7" },
  { id: "appliances", name: "Home appliances", slug: "home-appliances", icon: "home", accent: "#e5f0dd" },
];

export const stores: Store[] = [
  { id: "evo", name: "Evo Store", slug: "evo-store", logo: "E", delivery: "Free delivery in Kathmandu" },
  { id: "hukut", name: "Hukut", slug: "hukut", logo: "H", delivery: "Delivery across Nepal" },
  { id: "mudita", name: "Mudita Store", slug: "mudita-store", logo: "M", delivery: "Free delivery over NPR 5,000" },
  { id: "oliz", name: "Oliz Store", slug: "oliz-store", logo: "O", delivery: "Kathmandu valley delivery" },
  { id: "itti", name: "ITTI", slug: "itti", logo: "I", delivery: "Delivery across Nepal" },
];

const image = (id: string) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=900&q=85`;

export const products: Product[] = [
  {
    id: "iphone-16-128gb", name: "iPhone 16 128GB", slug: "apple-iphone-16-128gb", brand: "Apple", category: "Smartphones", categorySlug: "smartphones",
    description: "A refined everyday iPhone with the A18 chip, Camera Control, and a vibrant Super Retina XDR display.", image: image("photo-1592286927505-2fd0cfd0e5f5"), rating: 4.8, reviewCount: 218,
    specs: [{ label: "Display", value: "6.1-inch Super Retina XDR" }, { label: "Processor", value: "Apple A18 chip" }, { label: "Camera", value: "48MP Fusion camera" }, { label: "Storage", value: "128GB" }],
    offers: [{ id: "iphone-evo", productId: "iphone-16-128gb", storeId: "evo", price: 89999, previousPrice: 94999, availability: "in_stock", productUrl: "https://evostore.com.np", lastChecked: "Today" }, { id: "iphone-hukut", productId: "iphone-16-128gb", storeId: "hukut", price: 91500, availability: "in_stock", productUrl: "https://hukut.com", lastChecked: "Today" }, { id: "iphone-mudita", productId: "iphone-16-128gb", storeId: "mudita", price: 94999, availability: "in_stock", productUrl: "https://mudita.com.np", lastChecked: "Yesterday" }, { id: "iphone-oliz", productId: "iphone-16-128gb", storeId: "oliz", price: 99999, availability: "out_of_stock", productUrl: "https://olizstore.com", lastChecked: "Yesterday" }],
    history: [{ label: "Jun", price: 99999 }, { label: "Jul", price: 94999 }, { label: "Aug", price: 89999 }, { label: "Sep", price: 89999 }, { label: "Oct", price: 89999 }, { label: "Nov", price: 89999 }], featured: true,
  },
  {
    id: "galaxy-s25", name: "Samsung Galaxy S25 256GB", slug: "samsung-galaxy-s25-256gb", brand: "Samsung", category: "Smartphones", categorySlug: "smartphones", description: "Galaxy AI meets a pocket-sized powerhouse with a bright display and all-day battery.", image: image("photo-1610945265064-0e34e5519bbf"), rating: 4.7, reviewCount: 164, specs: [{ label: "Display", value: "6.2-inch Dynamic AMOLED 2X" }, { label: "Processor", value: "Snapdragon 8 Elite" }, { label: "Camera", value: "50MP wide camera" }, { label: "Storage", value: "256GB" }],
    offers: [{ id: "s25-evo", productId: "galaxy-s25", storeId: "evo", price: 109999, availability: "in_stock", productUrl: "https://evostore.com.np", lastChecked: "Today" }, { id: "s25-hukut", productId: "galaxy-s25", storeId: "hukut", price: 112000, availability: "in_stock", productUrl: "https://hukut.com", lastChecked: "Today" }, { id: "s25-oliz", productId: "galaxy-s25", storeId: "oliz", price: 115500, availability: "in_stock", productUrl: "https://olizstore.com", lastChecked: "2 days ago" }], history: [{ label: "Jun", price: 125000 }, { label: "Jul", price: 119999 }, { label: "Aug", price: 112000 }, { label: "Sep", price: 109999 }, { label: "Oct", price: 109999 }, { label: "Nov", price: 109999 }], featured: true,
  },
  {
    id: "macbook-air-m4", name: "MacBook Air M4 13-inch", slug: "apple-macbook-air-m4-13", brand: "Apple", category: "Laptops", categorySlug: "laptops", description: "Supercharged by M4, impossibly thin, and ready for work, study, and everything between.", image: image("photo-1517336714739-489689fd1ca8"), rating: 4.9, reviewCount: 97, specs: [{ label: "Display", value: "13.6-inch Liquid Retina" }, { label: "Processor", value: "Apple M4 chip" }, { label: "Memory", value: "16GB unified memory" }, { label: "Storage", value: "256GB SSD" }],
    offers: [{ id: "mac-evo", productId: "macbook-air-m4", storeId: "evo", price: 164999, availability: "in_stock", productUrl: "https://evostore.com.np", lastChecked: "Today" }, { id: "mac-hukut", productId: "macbook-air-m4", storeId: "hukut", price: 169500, availability: "in_stock", productUrl: "https://hukut.com", lastChecked: "Today" }, { id: "mac-itti", productId: "macbook-air-m4", storeId: "itti", price: 174999, availability: "in_stock", productUrl: "https://itti.com.np", lastChecked: "Yesterday" }], history: [{ label: "Jun", price: 179999 }, { label: "Jul", price: 174999 }, { label: "Aug", price: 169999 }, { label: "Sep", price: 164999 }, { label: "Oct", price: 164999 }, { label: "Nov", price: 164999 }], featured: true,
  },
  {
    id: "sony-xm5", name: "Sony WH-1000XM5", slug: "sony-wh-1000xm5", brand: "Sony", category: "Audio", categorySlug: "audio", description: "Industry-leading noise cancellation and exceptional sound for your everyday commute.", image: image("photo-1505740420928-5e560c06d30e"), rating: 4.6, reviewCount: 143, specs: [{ label: "Type", value: "Wireless over-ear" }, { label: "Battery", value: "Up to 30 hours" }, { label: "Noise canceling", value: "Industry-leading" }, { label: "Weight", value: "250g" }],
    offers: [{ id: "xm5-evo", productId: "sony-xm5", storeId: "evo", price: 39999, previousPrice: 44999, availability: "in_stock", productUrl: "https://evostore.com.np", lastChecked: "Today" }, { id: "xm5-mudita", productId: "sony-xm5", storeId: "mudita", price: 42500, availability: "in_stock", productUrl: "https://mudita.com.np", lastChecked: "Today" }, { id: "xm5-oliz", productId: "sony-xm5", storeId: "oliz", price: 44999, availability: "in_stock", productUrl: "https://olizstore.com", lastChecked: "2 days ago" }], history: [{ label: "Jun", price: 49999 }, { label: "Jul", price: 45999 }, { label: "Aug", price: 44999 }, { label: "Sep", price: 39999 }, { label: "Oct", price: 39999 }, { label: "Nov", price: 39999 }], featured: true,
  },
  {
    id: "pixel-9", name: "Google Pixel 9 128GB", slug: "google-pixel-9-128gb", brand: "Google", category: "Smartphones", categorySlug: "smartphones", description: "The helpful phone with a brilliant camera and Google's latest AI experiences.", image: image("photo-1511707171634-5f897ff02aa9"), rating: 4.5, reviewCount: 88, specs: [{ label: "Display", value: "6.3-inch Actua display" }, { label: "Processor", value: "Google Tensor G4" }, { label: "Camera", value: "50MP wide camera" }, { label: "Storage", value: "128GB" }], offers: [{ id: "pixel-hukut", productId: "pixel-9", storeId: "hukut", price: 84999, availability: "in_stock", productUrl: "https://hukut.com", lastChecked: "Today" }, { id: "pixel-oliz", productId: "pixel-9", storeId: "oliz", price: 89999, availability: "in_stock", productUrl: "https://olizstore.com", lastChecked: "Yesterday" }], history: [{ label: "Jun", price: 99999 }, { label: "Jul", price: 94999 }, { label: "Aug", price: 89999 }, { label: "Sep", price: 84999 }, { label: "Oct", price: 84999 }, { label: "Nov", price: 84999 }] },
  {
    id: "lg-oled-55", name: "LG 55-inch OLED C4", slug: "lg-55-inch-oled-c4", brand: "LG", category: "TVs", categorySlug: "televisions", description: "Brilliant self-lit pixels, cinematic contrast, and a beautifully slim profile.", image: image("photo-1593359677879-a4bb92f829d1"), rating: 4.7, reviewCount: 61, specs: [{ label: "Display", value: "55-inch 4K OLED" }, { label: "Refresh rate", value: "144Hz" }, { label: "Smart OS", value: "webOS 24" }, { label: "HDR", value: "Dolby Vision" }], offers: [{ id: "lg-evo", productId: "lg-oled-55", storeId: "evo", price: 174999, previousPrice: 189999, availability: "in_stock", productUrl: "https://evostore.com.np", lastChecked: "Today" }, { id: "lg-itti", productId: "lg-oled-55", storeId: "itti", price: 179999, availability: "in_stock", productUrl: "https://itti.com.np", lastChecked: "Today" }], history: [{ label: "Jun", price: 199999 }, { label: "Jul", price: 189999 }, { label: "Aug", price: 184999 }, { label: "Sep", price: 179999 }, { label: "Oct", price: 174999 }, { label: "Nov", price: 174999 }] },
];
