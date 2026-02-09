import dedent from 'dedent';

const mermaid = dedent(`import React, { useEffect, useRef, useState } from "react";
import {
  TransformWrapper,
  TransformComponent,
  ReactZoomPanPinchRef,
} from "react-zoom-pan-pinch";
import mermaid from "mermaid";
import { Button } from "/components/ui/button";

const ZoomIn = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/>
    <line x1="21" x2="16.65" y1="21" y2="16.65"/>
    <line x1="11" x2="11" y1="8" y2="14"/>
    <line x1="8" x2="14" y1="11" y2="11"/>
  </svg>
);

const ZoomOut = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/>
    <line x1="21" x2="16.65" y1="21" y2="16.65"/>
    <line x1="8" x2="14" y1="11" y2="11"/>
  </svg>
);

const RefreshCw = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
    <path d="M21 3v5h-5"/>
    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
    <path d="M8 16H3v5"/>
  </svg>
);

interface MermaidDiagramProps {
  content: string;
}

const MermaidDiagram: React.FC<MermaidDiagramProps> = ({ content }) => {
  const mermaidRef = useRef<HTMLDivElement>(null);
  const transformRef = useRef<ReactZoomPanPinchRef>(null);
  const [isRendered, setIsRendered] = useState(false);

  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: "forest",
      themeVariables: {
        fontSize: "16px",
        primaryColor: "#FF6B6B",
        primaryTextColor: "#fff",
        primaryBorderColor: "#FF6B6B",
        secondaryColor: "#4ECDC4",
        secondaryTextColor: "#fff",
        secondaryBorderColor: "#4ECDC4",
        tertiaryColor: "#95E1D3",
        tertiaryTextColor: "#000",
        tertiaryBorderColor: "#95E1D3",
        // 饼图专用颜色
        pie1: "#FF6B6B",
        pie2: "#4ECDC4",
        pie3: "#95E1D3",
        pie4: "#F38181",
        pie5: "#AA96DA",
        pie6: "#FCBAD3",
        pie7: "#A8D8EA",
        pie8: "#FFFFD2",
        pie9: "#FFA07A",
        pie10: "#98D8C8",
        pie11: "#F7DC6F",
        pie12: "#BB8FCE",
        pieTitleTextSize: "20px",
        pieTitleTextColor: "#000",
        pieSectionTextSize: "16px",
        pieSectionTextColor: "#fff",
        pieLegendTextSize: "14px",
        pieLegendTextColor: "#000",
        pieStrokeColor: "#fff",
        pieStrokeWidth: "2px",
        pieOpacity: "0.9",
      },
      flowchart: {
        curve: "basis",
        nodeSpacing: 50,
        rankSpacing: 50,
        diagramPadding: 8,
        htmlLabels: true,
        useMaxWidth: true,
        padding: 15,
        wrappingWidth: 200,
      },
      pie: {
        textPosition: 0.75,
        useWidth: 900,
      },
    });

    const renderDiagram = async () => {
      if (mermaidRef.current) {
        try {
          const { svg } = await mermaid.render("mermaid-diagram", content);
          mermaidRef.current.innerHTML = svg;

          const svgElement = mermaidRef.current.querySelector("svg");
          if (svgElement) {
            svgElement.style.width = "100%";
            svgElement.style.height = "100%";

            const pathElements = svgElement.querySelectorAll("path");
            pathElements.forEach((path) => {
              path.style.strokeWidth = "1.5px";
            });

            const rectElements = svgElement.querySelectorAll("rect");
            const barColors = ["#FF6B6B", "#4ECDC4", "#95E1D3", "#F38181", "#AA96DA", "#FCBAD3", "#A8D8EA"];
            let barIndex = 0;
            
            rectElements.forEach((rect) => {
              const parent = rect.parentElement;
              if (parent && parent.classList.contains("node")) {
                rect.style.stroke = "#636D83";
                rect.style.strokeWidth = "1px";
              } else {
                // 为柱状图的bar添加颜色
                const rectClass = rect.getAttribute("class") || "";
                if (rectClass.includes("bar") || rect.getAttribute("height")) {
                  const height = parseFloat(rect.getAttribute("height") || "0");
                  if (height > 20) { // 只为实际的柱状图bar上色
                    rect.style.fill = barColors[barIndex % barColors.length];
                    barIndex++;
                  }
                }
              }
            });
          }
          setIsRendered(true);
        } catch (error) {
          console.error("Mermaid rendering error:", error);
          const errorMessage = error instanceof Error ? error.message : String(error);
          const escapedError = errorMessage.replace(/</g, '&lt;').replace(/>/g, '&gt;');
          const escapedContent = content.replace(/</g, '&lt;').replace(/>/g, '&gt;');
          mermaidRef.current.innerHTML = 
            '<div style="padding: 20px; color: #ff6b6b; font-family: monospace; background: #2a2a2a; border-radius: 4px;">' +
              '<h3 style="margin-top: 0;">图表渲染错误</h3>' +
              '<pre style="white-space: pre-wrap; word-break: break-word; font-size: 12px;">' + escapedError + '</pre>' +
              '<details style="margin-top: 10px;">' +
                '<summary style="cursor: pointer;">查看原始内容</summary>' +
                '<pre style="white-space: pre-wrap; word-break: break-word; font-size: 11px; margin-top: 10px; opacity: 0.7;">' + escapedContent + '</pre>' +
              '</details>' +
            '</div>';
        }
      }
    };

    renderDiagram();
  }, [content]);

  const centerAndFitDiagram = () => {
    if (transformRef.current && mermaidRef.current) {
      const { centerView, zoomToElement } = transformRef.current;
      zoomToElement(mermaidRef.current as HTMLElement);
      centerView(1, 0);
    }
  };

  useEffect(() => {
    if (isRendered) {
      centerAndFitDiagram();
    }
  }, [isRendered]);

  const handlePanning = () => {
    if (transformRef.current) {
      const { state, instance } = transformRef.current;
      if (!state) {
        return;
      }
      const { scale, positionX, positionY } = state;
      const { wrapperComponent, contentComponent } = instance;

      if (wrapperComponent && contentComponent) {
        const wrapperRect = wrapperComponent.getBoundingClientRect();
        const contentRect = contentComponent.getBoundingClientRect();
        const maxX = wrapperRect.width - contentRect.width * scale;
        const maxY = wrapperRect.height - contentRect.height * scale;

        let newX = positionX;
        let newY = positionY;

        if (newX > 0) {
          newX = 0;
        }
        if (newY > 0) {
          newY = 0;
        }
        if (newX < maxX) {
          newX = maxX;
        }
        if (newY < maxY) {
          newY = maxY;
        }

        if (newX !== positionX || newY !== positionY) {
          instance.setTransformState(scale, newX, newY);
        }
      }
    }
  };

  return (
    <div className="relative h-screen w-screen cursor-move bg-[#282C34] p-5">
      <TransformWrapper
        ref={transformRef}
        initialScale={1}
        minScale={0.1}
        maxScale={10}
        limitToBounds={false}
        centerOnInit={true}
        initialPositionY={0}
        wheel={{ step: 0.1 }}
        panning={{ velocityDisabled: true }}
        alignmentAnimation={{ disabled: true }}
        onPanning={handlePanning}
      >
        {({ zoomIn, zoomOut }) => (
          <>
            <TransformComponent
              wrapperStyle={{
                width: "100%",
                height: "100%",
                overflow: "hidden",
              }}
            >
              <div
                ref={mermaidRef}
                style={{
                  width: "auto",
                  height: "auto",
                  minWidth: "100%",
                  minHeight: "100%",
                }}
              />
            </TransformComponent>
            <div className="absolute bottom-2 right-2 flex space-x-2">
              <Button onClick={() => zoomIn(0.1)} variant="outline" size="icon">
                <ZoomIn />
              </Button>
              <Button
                onClick={() => zoomOut(0.1)}
                variant="outline"
                size="icon"
              >
                <ZoomOut />
              </Button>
              <Button
                onClick={centerAndFitDiagram}
                variant="outline"
                size="icon"
              >
                <RefreshCw />
              </Button>
            </div>
          </>
        )}
      </TransformWrapper>
    </div>
  );
};

export default MermaidDiagram;`);

const wrapMermaidDiagram = (content: string) => {
  return dedent(`import React from 'react';
import MermaidDiagram from '/components/ui/MermaidDiagram';

export default App = () => (
  <MermaidDiagram content={\`${content}\`} />
);
`);
};

const mermaidCSS = `
body {
  background-color: #282C34;
}
`;

export const getMermaidFiles = (content: string) => {
  return {
    'diagram.mmd': content || '# No mermaid diagram content provided',
    'App.tsx': wrapMermaidDiagram(content),
    'index.tsx': dedent(`import React, { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import "./mermaid.css";

import App from "./App";

const root = createRoot(document.getElementById("root"));
root.render(<App />);
;`),
    '/components/ui/MermaidDiagram.tsx': mermaid,
    'mermaid.css': mermaidCSS,
  };
};
