import fs from "fs";
import path from "path";

type AccountName = "Mujo" | "Ruby" | "Manuka";

type ListingRow = {
  ID: string;
  Title: string;
  "Internal Name": string;
  Type: string;
  Location: string;
  Status: string;
  "Host Editor URL": string;
  "Public URL": string;
  "Extracted At": string;
};

type AccountListing = ListingRow & {
  sourceAccount: AccountName;
};

type ClassifiedListing = {
  id: string;
  canonicalAccount: AccountName;
  visibilityTier: "manuka_ruby_mujo" | "ruby_mujo" | "mujo_only";
  visibleInAccounts: AccountName[];
  title: string;
  internalName: string;
  statusByAccount: Partial<Record<AccountName, string>>;
  sourceRows: Partial<Record<AccountName, ListingRow>>;
};

type ClassificationOutput = {
  generatedAt: string;
  accountHierarchy: AccountName[];
  backwardTraceOrder: AccountName[];
  sourceFiles: Record<AccountName, string>;
  summary: {
    rowsByAccount: Record<AccountName, number>;
    uniqueListingCount: number;
    tierCounts: Record<ClassifiedListing["visibilityTier"], number>;
    duplicateIdsByAccount: Partial<Record<AccountName, string[]>>;
    hierarchyValidation: {
      manukaSubsetOfRuby: boolean;
      rubySubsetOfMujo: boolean;
      missingFromRuby: string[];
      missingFromMujo: string[];
    };
  };
  listings: ClassifiedListing[];
};

const accountHierarchy: AccountName[] = ["Mujo", "Ruby", "Manuka"];
const backwardTraceOrder: AccountName[] = ["Manuka", "Ruby", "Mujo"];
const sourceFiles: Record<AccountName, string> = {
  Mujo: "listings.csv",
  Ruby: "Ruby.csv",
  Manuka: "Manuka.csv",
};

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const nextCharacter = line[index + 1];

    if (character === '"' && inQuotes && nextCharacter === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (character === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (character === "," && !inQuotes) {
      cells.push(current);
      current = "";
      continue;
    }

    current += character;
  }

  cells.push(current);
  return cells;
}

function parseListingsCsv(filePath: string): ListingRow[] {
  const content = fs.readFileSync(filePath, "utf8").replace(/^\uFEFF/, "");
  const [headerLine, ...dataLines] = content.split(/\r?\n/).filter((line) => line.trim().length > 0);

  if (!headerLine) {
    throw new Error(`CSV file is empty: ${filePath}`);
  }

  const headers = parseCsvLine(headerLine);
  const requiredHeaders = [
    "ID",
    "Title",
    "Internal Name",
    "Type",
    "Location",
    "Status",
    "Host Editor URL",
    "Public URL",
    "Extracted At",
  ];

  const missingHeaders = requiredHeaders.filter((header) => !headers.includes(header));
  if (missingHeaders.length > 0) {
    throw new Error(`CSV file ${filePath} is missing headers: ${missingHeaders.join(", ")}`);
  }

  return dataLines.map((line, lineIndex) => {
    const cells = parseCsvLine(line);
    const row: Record<string, string> = {};

    headers.forEach((header, headerIndex) => {
      row[header] = cells[headerIndex] ?? "";
    });

    if (!row.ID) {
      throw new Error(`CSV file ${filePath} row ${lineIndex + 2} has empty ID`);
    }

    return {
      ID: row.ID,
      Title: row.Title ?? "",
      "Internal Name": row["Internal Name"] ?? "",
      Type: row.Type ?? "",
      Location: row.Location ?? "",
      Status: row.Status ?? "",
      "Host Editor URL": row["Host Editor URL"] ?? "",
      "Public URL": row["Public URL"] ?? "",
      "Extracted At": row["Extracted At"] ?? "",
    };
  });
}

function findDuplicateIds(rows: ListingRow[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const row of rows) {
    if (seen.has(row.ID)) {
      duplicates.add(row.ID);
      continue;
    }

    seen.add(row.ID);
  }

  return [...duplicates].sort();
}

function uniqueById(rows: AccountListing[]): AccountListing[] {
  const listingsById = new Map<string, AccountListing>();

  for (const row of rows) {
    if (!listingsById.has(row.ID)) {
      listingsById.set(row.ID, row);
    }
  }

  return [...listingsById.values()];
}

function classifyListing(id: string, rowsByAccount: Record<AccountName, Map<string, ListingRow>>): ClassifiedListing {
  const visibleInAccounts = accountHierarchy.filter((account) => rowsByAccount[account].has(id));

  const canonicalAccount = backwardTraceOrder.find((account) => rowsByAccount[account].has(id));
  if (!canonicalAccount) {
    throw new Error(`Listing ${id} cannot be classified because it is absent from all accounts`);
  }

  const representativeRow = rowsByAccount[canonicalAccount].get(id);
  if (!representativeRow) {
    throw new Error(`Listing ${id} is missing representative row for ${canonicalAccount}`);
  }

  const sourceRows: Partial<Record<AccountName, ListingRow>> = {};
  const statusByAccount: Partial<Record<AccountName, string>> = {};

  for (const account of accountHierarchy) {
    const row = rowsByAccount[account].get(id);
    if (row) {
      sourceRows[account] = row;
      statusByAccount[account] = row.Status;
    }
  }

  const visibilityTier = canonicalAccount === "Manuka"
    ? "manuka_ruby_mujo"
    : canonicalAccount === "Ruby"
      ? "ruby_mujo"
      : "mujo_only";

  return {
    id,
    canonicalAccount,
    visibilityTier,
    visibleInAccounts,
    title: representativeRow.Title,
    internalName: representativeRow["Internal Name"],
    statusByAccount,
    sourceRows,
  };
}

function ensureSubset(subset: Set<string>, superset: Set<string>): string[] {
  return [...subset].filter((id) => !superset.has(id)).sort();
}

function main() {
  const repoRoot = path.resolve(__dirname, "../..");
  const inputDirectory = path.resolve(repoRoot, "database_design");
  const outputPath = path.resolve(inputDirectory, "listing-account-classification.json");

  const rawRowsByAccount: Record<AccountName, ListingRow[]> = {
    Mujo: parseListingsCsv(path.resolve(inputDirectory, sourceFiles.Mujo)),
    Ruby: parseListingsCsv(path.resolve(inputDirectory, sourceFiles.Ruby)),
    Manuka: parseListingsCsv(path.resolve(inputDirectory, sourceFiles.Manuka)),
  };

  const duplicateIdsByAccount = Object.fromEntries(
    accountHierarchy
      .map((account) => [account, findDuplicateIds(rawRowsByAccount[account])] as const)
      .filter(([, duplicateIds]) => duplicateIds.length > 0),
  ) as Partial<Record<AccountName, string[]>>;

  const rowsByAccount: Record<AccountName, Map<string, ListingRow>> = {
    Mujo: new Map(uniqueById(rawRowsByAccount.Mujo.map((row) => ({ ...row, sourceAccount: "Mujo" }))).map((row) => [row.ID, row])),
    Ruby: new Map(uniqueById(rawRowsByAccount.Ruby.map((row) => ({ ...row, sourceAccount: "Ruby" }))).map((row) => [row.ID, row])),
    Manuka: new Map(uniqueById(rawRowsByAccount.Manuka.map((row) => ({ ...row, sourceAccount: "Manuka" }))).map((row) => [row.ID, row])),
  };

  const mujoIds = new Set(rowsByAccount.Mujo.keys());
  const rubyIds = new Set(rowsByAccount.Ruby.keys());
  const manukaIds = new Set(rowsByAccount.Manuka.keys());
  const missingFromRuby = ensureSubset(manukaIds, rubyIds);
  const missingFromMujo = ensureSubset(rubyIds, mujoIds);
  const uniqueIds = [...new Set([...mujoIds, ...rubyIds, ...manukaIds])].sort((first, second) => Number(first) - Number(second));
  const listings = uniqueIds.map((id) => classifyListing(id, rowsByAccount));
  const tierCounts: Record<ClassifiedListing["visibilityTier"], number> = {
    manuka_ruby_mujo: 0,
    ruby_mujo: 0,
    mujo_only: 0,
  };

  for (const listing of listings) {
    tierCounts[listing.visibilityTier] += 1;
  }

  const output: ClassificationOutput = {
    generatedAt: new Date().toISOString(),
    accountHierarchy,
    backwardTraceOrder,
    sourceFiles,
    summary: {
      rowsByAccount: {
        Mujo: rawRowsByAccount.Mujo.length,
        Ruby: rawRowsByAccount.Ruby.length,
        Manuka: rawRowsByAccount.Manuka.length,
      },
      uniqueListingCount: listings.length,
      tierCounts,
      duplicateIdsByAccount,
      hierarchyValidation: {
        manukaSubsetOfRuby: missingFromRuby.length === 0,
        rubySubsetOfMujo: missingFromMujo.length === 0,
        missingFromRuby,
        missingFromMujo,
      },
    },
    listings,
  };

  fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`);

  console.log(`Wrote ${outputPath}`);
  console.log(JSON.stringify(output.summary, null, 2));

  if (missingFromRuby.length > 0 || missingFromMujo.length > 0) {
    process.exitCode = 1;
  }
}

main();
