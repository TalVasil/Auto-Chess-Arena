import React, { useState, useRef, useEffect } from 'react';
import './Tooltip.css';

interface TooltipProps {
  text: string;
  children: React.ReactNode;
}

export function Tooltip({ text, children }: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isVisible && containerRef.current && tooltipRef.current) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const tooltipRect = tooltipRef.current.getBoundingClientRect();

      // Position tooltip above the element, centered
      let top = -tooltipRect.height - 8;
      let left = (containerRect.width - tooltipRect.width) / 2;

      // Adjust if tooltip would go off screen
      const absoluteLeft = containerRect.left + left;
      if (absoluteLeft < 10) {
        left = -containerRect.left + 10;
      } else if (absoluteLeft + tooltipRect.width > window.innerWidth - 10) {
        left = window.innerWidth - 10 - tooltipRect.width - containerRect.left;
      }

      setPosition({ top, left });
    }
  }, [isVisible]);

  return (
    <div
      ref={containerRef}
      className="tooltip-container"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      {isVisible && (
        <div
          ref={tooltipRef}
          className="custom-tooltip"
          style={{ top: position.top, left: position.left }}
        >
          {text}
        </div>
      )}
    </div>
  );
}
