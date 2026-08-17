export type TidePrediction = {
  /** Epoch milliseconds. */
  time: number;
  height: number;
}

export type TideExtreme = TidePrediction & {
  /** 'H' for high tide, 'L' for low tide. */
  type: 'H' | 'L';
}

export type TideData = {
  predictions: TidePrediction[];
  extremes: TideExtreme[];
}
