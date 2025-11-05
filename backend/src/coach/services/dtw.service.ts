import { Injectable } from '@nestjs/common';

export interface DTWResult {
  path: [number, number][]; // [iRef, jStudent] pairs
  cost: number;
}

@Injectable()
export class DTWService {
  /**
   * Perform multivariate Dynamic Time Warping with Sakoe-Chiba band constraint
   * @param reference Reference feature vectors [numBeats][k]
   * @param student Student feature vectors [numBeats][k]
   * @param weights Feature weights [k] - importance of each dimension
   * @param bandPct Sakoe-Chiba band percentage (default 0.1 = 10%)
   * @returns DTW alignment path and total cost
   */
  multivariateDTW(
    reference: number[][],
    student: number[][],
    weights: number[],
    bandPct: number = 0.1,
  ): DTWResult {
    const M = reference.length; // Reference length
    const N = student.length;   // Student length
    
    if (M === 0 || N === 0) {
      return { path: [], cost: Infinity };
    }

    // Calculate Sakoe-Chiba band width
    const maxLength = Math.max(M, N);
    const bandWidth = Math.floor(maxLength * bandPct);

    // Initialize cost matrix with infinity
    const costMatrix: number[][] = Array(M + 1).fill(null).map(() => 
      Array(N + 1).fill(Infinity)
    );

    // Initialize first cell
    costMatrix[0][0] = 0;

    // Fill the cost matrix with band constraint
    for (let i = 1; i <= M; i++) {
      for (let j = 1; j <= N; j++) {
        // Apply Sakoe-Chiba band constraint
        if (this.isWithinBand(i - 1, j - 1, M, N, bandWidth)) {
          const distance = this.weightedEuclideanDistance(
            reference[i - 1],
            student[j - 1],
            weights
          );

          const cost = distance + Math.min(
            costMatrix[i - 1][j],     // insertion
            costMatrix[i][j - 1],     // deletion
            costMatrix[i - 1][j - 1]  // match
          );

          costMatrix[i][j] = cost;
        }
      }
    }

    // Backtrack to find the optimal path
    const path = this.backtrackPath(costMatrix, M, N, bandWidth);
    const totalCost = costMatrix[M][N];

    return {
      path,
      cost: totalCost,
    };
  }

  /**
   * Check if a cell (i, j) is within the Sakoe-Chiba band
   */
  private isWithinBand(i: number, j: number, M: number, N: number, bandWidth: number): boolean {
    // Calculate the diagonal line from (0,0) to (M-1, N-1)
    const diagonalJ = Math.round((j * M) / N);
    const diagonalI = Math.round((i * N) / M);
    
    // Check if within band around the diagonal
    return Math.abs(i - diagonalJ) <= bandWidth && Math.abs(j - diagonalI) <= bandWidth;
  }

  /**
   * Calculate weighted Euclidean distance between two feature vectors
   */
  private weightedEuclideanDistance(vec1: number[], vec2: number[], weights: number[]): number {
    if (vec1.length !== vec2.length || vec1.length !== weights.length) {
      throw new Error('Vector dimensions must match');
    }

    let sum = 0;
    for (let i = 0; i < vec1.length; i++) {
      const diff = vec1[i] - vec2[i];
      sum += weights[i] * diff * diff;
    }

    return Math.sqrt(sum);
  }

  /**
   * Backtrack through the cost matrix to find the optimal alignment path
   */
  private backtrackPath(costMatrix: number[][], M: number, N: number, bandWidth: number): [number, number][] {
    const path: [number, number][] = [];
    let i = M;
    let j = N;

    while (i > 0 && j > 0) {
      path.unshift([i - 1, j - 1]); // Add to beginning of array

      // Find the direction that led to current cell
      const current = costMatrix[i][j];
      const diagonal = costMatrix[i - 1][j - 1];
      const up = costMatrix[i - 1][j];
      const left = costMatrix[i][j - 1];

      // Choose the path with minimum cost (prioritize diagonal for stability)
      if (diagonal <= up && diagonal <= left) {
        i--;
        j--;
      } else if (up <= left) {
        i--;
      } else {
        j--;
      }
    }

    // Handle remaining cells if one sequence is longer
    while (i > 0) {
      path.unshift([i - 1, j - 1]);
      i--;
    }
    while (j > 0) {
      path.unshift([i - 1, j - 1]);
      j--;
    }

    return path;
  }

  /**
   * Utility function to visualize DTW path for debugging
   */
  visualizePath(reference: number[][], student: number[][], path: [number, number][]): string {
    const M = reference.length;
    const N = student.length;
    
    const grid: string[][] = Array(M).fill(null).map(() => Array(N).fill('.'));
    
    for (const [i, j] of path) {
      if (i >= 0 && i < M && j >= 0 && j < N) {
        grid[i][j] = 'X';
      }
    }

    return grid.map(row => row.join(' ')).join('\n');
  }

  /**
   * Calculate alignment quality metrics
   */
  calculateAlignmentMetrics(path: [number, number][], referenceLength: number, studentLength: number): {
    compressionRatio: number;
    pathLength: number;
    averageWarp: number;
  } {
    const pathLength = path.length;
    const expectedLength = Math.max(referenceLength, studentLength);
    const compressionRatio = pathLength / expectedLength;

    // Calculate average warping (deviation from diagonal)
    let totalWarp = 0;
    for (const [i, j] of path) {
      const expectedJ = (i * studentLength) / referenceLength;
      totalWarp += Math.abs(j - expectedJ);
    }
    const averageWarp = totalWarp / pathLength;

    return {
      compressionRatio,
      pathLength,
      averageWarp,
    };
  }
}
