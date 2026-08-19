"use client";

import Image, { type ImageProps } from "next/image";
import { useState } from "react";

const fallback = "/product-placeholder.svg";

export function SafeImage({ src, alt, ...props }: ImageProps) {
  const [imageSrc, setImageSrc] = useState(src);
  return <Image {...props} src={imageSrc} alt={alt} onError={() => setImageSrc(fallback)} />;
}
