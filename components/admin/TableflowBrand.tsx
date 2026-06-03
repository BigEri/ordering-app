import Image from "next/image";

type TableflowBrandProps = {
  className?: string;
};

/** Logo Tableflow (t + nápis) pro admin sidebar. */
export function TableflowBrand({ className }: TableflowBrandProps) {
  return (
    <div className={className ? `tableflowBrand ${className}` : "tableflowBrand"} aria-label="Tableflow">
      <Image
        src="/branding/tableflow-logo.png"
        alt="Tableflow"
        width={350}
        height={405}
        className="tableflowBrand__img"
        priority={false}
      />
    </div>
  );
}
