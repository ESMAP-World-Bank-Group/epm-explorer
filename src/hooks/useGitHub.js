import { useState, useEffect, useRef } from 'react'
import Papa from 'papaparse'
import { listBranches, fetchText, fetchJson } from '../api/github'

const cache = new Map()

async function cachedFetch(key, fetcher) {
  if (cache.has(key)) return cache.get(key)
  const p = fetcher()
  cache.set(key, p)
  try { return await p } catch (e) { cache.delete(key); throw e }
}

export function useBranches() {
  const [branches, setBranches] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState(null)

  useEffect(() => {
    cachedFetch('__branches', listBranches)
      .then(setBranches)
      .catch(setError)
      .finally(() => setLoading(false))
  }, [])

  return { branches, loading, error }
}

export function useModel(branch) {
  const [model, setModel]   = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState(null)

  useEffect(() => {
    if (!branch) return
    setLoading(true)
    // Try to find model.json — data folder name derived from branch
    const modelName = branch.replace(/_\d{4}$/, '')
    const dataFolder = `data_${modelName}`
    cachedFetch(`model:${branch}`, () =>
      fetchJson(branch, `epm/input/${dataFolder}/model.json`)
        .catch(() => ({
          name: modelName.replace(/_/g, ' '),
          type: 'national',
          year: parseInt(branch.match(/_(\d{4})$/)?.[1]),
          countries: [],
          zones: [],
          data_folder: dataFolder,
        }))
    )
      .then(setModel)
      .catch(setError)
      .finally(() => setLoading(false))
  }, [branch])

  return { model, loading, error }
}

export function useCSV(branch, path) {
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState(null)

  useEffect(() => {
    if (!branch || !path) return
    setLoading(true)
    cachedFetch(`csv:${branch}:${path}`, () =>
      fetchText(branch, path).then(text =>
        new Promise((resolve, reject) =>
          Papa.parse(text, {
            header: true,
            skipEmptyLines: true,
            dynamicTyping: true,
            complete: r => resolve(r.data),
            error: reject,
          })
        )
      )
    )
      .then(setData)
      .catch(setError)
      .finally(() => setLoading(false))
  }, [branch, path])

  return { data, loading, error }
}

export function useMultiCSV(branch, paths) {
  const [results, setResults] = useState({})
  const [loading, setLoading] = useState(true)
  const pathsKey = paths.join('|')

  useEffect(() => {
    if (!branch || !paths.length) return
    setLoading(true)
    Promise.all(
      paths.map(p =>
        cachedFetch(`csv:${branch}:${p}`, () =>
          fetchText(branch, p).then(text =>
            new Promise((resolve, reject) =>
              Papa.parse(text, {
                header: true,
                skipEmptyLines: true,
                dynamicTyping: true,
                complete: r => resolve(r.data),
                error: reject,
              })
            )
          )
        ).catch(() => null)
      )
    ).then(all => {
      const out = {}
      paths.forEach((p, i) => { out[p] = all[i] })
      setResults(out)
    }).finally(() => setLoading(false))
  }, [branch, pathsKey])

  return { results, loading }
}
