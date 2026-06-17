"use client";

import { SearchOutlined } from "@ant-design/icons";
import { Input } from "antd";
import { useMemo, useState } from "react";
import { WorkItemsAntTable, type WorkItemAntTableRow } from "@/components/WorkItemsAntTable";

export type TeamPersonTable = {
  email: string;
  id: string;
  name: string;
  rows: WorkItemAntTableRow[];
};

type TeamPersonTablesProps = {
  people: TeamPersonTable[];
};

function highlightName(name: string, query: string) {
  const trimmedQuery = query.trim();

  if (!trimmedQuery) {
    return name;
  }

  const matchIndex = name.toLocaleLowerCase().indexOf(trimmedQuery.toLocaleLowerCase());

  if (matchIndex === -1) {
    return name;
  }

  const matchEnd = matchIndex + trimmedQuery.length;

  return (
    <>
      {name.slice(0, matchIndex)}
      <mark>{name.slice(matchIndex, matchEnd)}</mark>
      {name.slice(matchEnd)}
    </>
  );
}

export function TeamPersonTables({ people }: TeamPersonTablesProps) {
  const [nameSearch, setNameSearch] = useState("");
  const normalizedSearch = nameSearch.trim().toLocaleLowerCase();
  const filteredPeople = useMemo(
    () =>
      normalizedSearch
        ? people.filter((person) => person.name.toLocaleLowerCase().includes(normalizedSearch))
        : people,
    [normalizedSearch, people]
  );

  return (
    <>
      <div className="team-name-search" role="search">
        <Input
          allowClear
          aria-label="Search people by name"
          onChange={(event) => setNameSearch(event.target.value)}
          placeholder="Search person name"
          prefix={<SearchOutlined aria-hidden="true" />}
          value={nameSearch}
        />
      </div>
      <section className="team-person-table-list" aria-label="Ongoing work by person">
        {filteredPeople.length ? (
          filteredPeople.map((person) => (
            <section className="panel team-person-table" key={person.id}>
              <div className="section-toolbar team-person-heading">
                <h2>{highlightName(person.name, nameSearch)}</h2>
              </div>
              {person.rows.length ? (
                <WorkItemsAntTable
                  enableProjectSort={false}
                  groupByProject
                  rows={person.rows}
                  showDue={false}
                  showOpenDays
                  showPriority={false}
                  showProject
                  showResetFilters={false}
                  showResetSorters={false}
                  showStart={false}
                  showStatus={false}
                  showToolbarTitle={false}
                  title={`${person.name} ongoing work`}
                />
              ) : (
                <div className="notice team-person-empty">No ongoing work.</div>
              )}
            </section>
          ))
        ) : (
          <div className="notice team-search-empty">No matching people.</div>
        )}
      </section>
    </>
  );
}
