import React, { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

interface BarcodeProps {
  value: string;
  width?: number;
  height?: number;
  fontSize?: number;
  format?: string;
  className?: string;
}

export const BarcodeGenerator: React.FC<BarcodeProps> = ({
  value,
  width = 1.8,
  height = 40,
  fontSize = 12,
  format = 'CODE128',
  className = '',
}) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (svgRef.current && value) {
      try {
        JsBarcode(svgRef.current, value, {
          format,
          width,
          height,
          displayValue: true,
          fontSize,
          margin: 4,
          background: '#ffffff',
          lineColor: '#1e293b',
        });
      } catch (err) {
        console.error("JsBarcode error:", err);
      }
    }
  }, [value, width, height, fontSize, format]);

  return <svg ref={svgRef} className={className}></svg>;
};
