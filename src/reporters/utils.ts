export class ProgressBar {
  private width: number;
  private undoneSymbol: string;
  private doneSymbol: string;
  private units: number;

  constructor(opts: {
    width: number;
    undoneSymbol: string;
    doneSymbol: string;
  }) {
    const parameters = {
      width: 10,
      undoneSymbol: "-",
      doneSymbol: ">",
      ...opts,
    };
    this.width = parameters.width;
    this.undoneSymbol = parameters.undoneSymbol;
    this.doneSymbol = parameters.doneSymbol;
    this.units = 100 / this.width;
  }

  public render = (percent) => {
    const steps = Math.floor(percent / this.units);
    return `${"".padStart(steps, this.doneSymbol)}${"".padStart(
      this.width - steps,
      this.undoneSymbol
    )}`;
  };
}
