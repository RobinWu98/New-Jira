"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type PageHeaderProps = {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children?: React.ReactNode;
  hideBack?: boolean;
};

export function PageHeader({ title, subtitle, children, hideBack = false }: PageHeaderProps) {
  const router = useRouter();
  const [canGoBack, setCanGoBack] = useState(false);

  useEffect(() => {
    setCanGoBack(window.history.length > 1);
  }, []);

  return (
    <header className={`masthead masthead-with-back${hideBack ? " no-back" : ""}`}>
      <div className="masthead-content">
        {typeof title === "string" ? <h1>{title}</h1> : title}
        {subtitle ? <p>{subtitle}</p> : null}
        {children ? <div className="masthead-extra">{children}</div> : null}
      </div>
      {!hideBack && canGoBack ? (
        <button type="button" className="back-button" onClick={() => router.back()}>
          <span aria-hidden="true">←</span>
          <span className="sr-only">Go back</span>
        </button>
      ) : null}
    </header>
  );
}
