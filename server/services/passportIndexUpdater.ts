/**
 * passportIndexUpdater.ts
 *
 * Auto-update mechanism for the Passport Index dataset.
 * Source: https://github.com/ilyankou/passport-index-dataset
 *
 * The dataset is updated every 2-4 weeks by the maintainer.
 * This service downloads the latest version on-demand or via scheduled check.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { loadPassportIndex } from './passportIndexService';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// =============================================================================
// CONFIGURATION
// =============================================================================

const DATASET_URL = 'https://raw.githubusercontent.com/ilyankou/passport-index-dataset/master/passport-index-tidy.csv';
const CSV_PATH = path.join(__dirname, '../data/passport-index.csv');
const METADATA_PATH = path.join(__dirname, '../data/passport-index-metadata.json');

// Check for updates if data is older than 7 days
const STALE_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;

// =============================================================================
// TYPES
// =============================================================================

interface DatasetMetadata {
  lastUpdated: string;
  lastChecked: string;
  rowCount: number;
  sourceUrl: string;
  version: string;
}

// =============================================================================
// METADATA MANAGEMENT
// =============================================================================

function loadMetadata(): DatasetMetadata | null {
  try {
    if (fs.existsSync(METADATA_PATH)) {
      const content = fs.readFileSync(METADATA_PATH, 'utf-8');
      return JSON.parse(content);
    }
  } catch (error) {
    console.warn('[PassportIndexUpdater] Could not load metadata:', error);
  }
  return null;
}

function saveMetadata(metadata: DatasetMetadata): void {
  try {
    fs.writeFileSync(METADATA_PATH, JSON.stringify(metadata, null, 2));
  } catch (error) {
    console.error('[PassportIndexUpdater] Could not save metadata:', error);
  }
}

// =============================================================================
// UPDATE FUNCTIONS
// =============================================================================

/**
 * Download the latest dataset from GitHub
 */
export async function updateDataset(): Promise<{
  success: boolean;
  message: string;
  rowCount?: number;
  previousRowCount?: number;
}> {
  console.log('[PassportIndexUpdater] Downloading latest dataset...');

  try {
    const response = await fetch(DATASET_URL);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const content = await response.text();
    const lines = content.split('\n').filter(line => line.trim());
    const rowCount = lines.length - 1; // Exclude header

    if (rowCount < 30000) {
      throw new Error(`Dataset seems incomplete: only ${rowCount} rows (expected 39,000+)`);
    }

    // Load previous metadata for comparison
    const previousMetadata = loadMetadata();
    const previousRowCount = previousMetadata?.rowCount;

    // Ensure data directory exists
    const dataDir = path.dirname(CSV_PATH);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Write new dataset
    fs.writeFileSync(CSV_PATH, content);

    // Update metadata
    const metadata: DatasetMetadata = {
      lastUpdated: new Date().toISOString(),
      lastChecked: new Date().toISOString(),
      rowCount,
      sourceUrl: DATASET_URL,
      version: new Date().toISOString().split('T')[0], // YYYY-MM-DD
    };
    saveMetadata(metadata);

    // Reload the service with new data
    loadPassportIndex();

    const changeInfo = previousRowCount
      ? ` (was ${previousRowCount.toLocaleString()}, diff: ${rowCount - previousRowCount})`
      : '';

    console.log(`[PassportIndexUpdater] Updated successfully: ${rowCount.toLocaleString()} routes${changeInfo}`);

    return {
      success: true,
      message: `Dataset updated: ${rowCount.toLocaleString()} visa routes loaded`,
      rowCount,
      previousRowCount: previousRowCount || undefined,
    };

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[PassportIndexUpdater] Update failed:', message);
    return {
      success: false,
      message: `Update failed: ${message}`,
    };
  }
}

/**
 * Check if the dataset needs updating (older than STALE_THRESHOLD_MS)
 */
export function isStale(): boolean {
  const metadata = loadMetadata();
  if (!metadata) return true;

  const lastUpdated = new Date(metadata.lastUpdated).getTime();
  const age = Date.now() - lastUpdated;

  return age > STALE_THRESHOLD_MS;
}

/**
 * Get current dataset status
 */
export function getDatasetStatus(): {
  exists: boolean;
  lastUpdated: string | null;
  lastChecked: string | null;
  rowCount: number | null;
  isStale: boolean;
  ageInDays: number | null;
} {
  const metadata = loadMetadata();
  const exists = fs.existsSync(CSV_PATH);

  if (!metadata) {
    return {
      exists,
      lastUpdated: null,
      lastChecked: null,
      rowCount: null,
      isStale: true,
      ageInDays: null,
    };
  }

  const lastUpdatedTime = new Date(metadata.lastUpdated).getTime();
  const ageMs = Date.now() - lastUpdatedTime;
  const ageInDays = Math.floor(ageMs / (24 * 60 * 60 * 1000));

  return {
    exists,
    lastUpdated: metadata.lastUpdated,
    lastChecked: metadata.lastChecked,
    rowCount: metadata.rowCount,
    isStale: ageMs > STALE_THRESHOLD_MS,
    ageInDays,
  };
}

/**
 * Check for updates and download if stale (non-blocking)
 * Call this on server startup
 */
export async function checkAndUpdateIfStale(): Promise<void> {
  const status = getDatasetStatus();

  if (!status.exists) {
    console.log('[PassportIndexUpdater] Dataset not found, downloading...');
    await updateDataset();
    return;
  }

  if (status.isStale) {
    console.log(`[PassportIndexUpdater] Dataset is ${status.ageInDays} days old, updating in background...`);
    // Don't await - update in background
    updateDataset().catch(err => {
      console.error('[PassportIndexUpdater] Background update failed:', err);
    });
  } else {
    console.log(`[PassportIndexUpdater] Dataset is fresh (${status.ageInDays} days old, ${status.rowCount?.toLocaleString()} routes)`);
  }
}
