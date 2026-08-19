import {
  Camera,
  Gamepad2,
  Headphones,
  Home,
  Laptop,
  Smartphone,
  Tv,
  Watch,
} from "lucide-react";
const icons = {
  phone: Smartphone,
  laptop: Laptop,
  headphones: Headphones,
  tv: Tv,
  camera: Camera,
  gamepad: Gamepad2,
  watch: Watch,
  home: Home,
};
export function CategoryIcon({
  name,
  size = 22,
}: {
  name: keyof typeof icons;
  size?: number;
}) {
  const Icon = icons[name] ?? Home;
  return <Icon size={size} strokeWidth={1.7} />;
}
