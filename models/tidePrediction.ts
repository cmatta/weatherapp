export type TidePrediction = {
  time: string;
  height: number;
}

export type TideData = {
  predictions: TidePrediction[];
}