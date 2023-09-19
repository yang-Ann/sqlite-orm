import SqliteOrm from "../SqliteOrm.js";
// vitest: https://cn.vitest.dev/guide/
import { test, expect, describe } from "vitest";
const sqliteOrm = new SqliteOrm("test.db");
const datas = [
    { name: "张三", age: 18, gex: "男" },
    { name: "李四", age: 16, gex: "男" },
    { name: "王五", age: 18, gex: "女" },
    { name: "小明", age: 30, gex: "男" },
    { name: "小张", age: 22, gex: "男" }
];
test("create sql", () => {
    const sql0 = sqliteOrm.buildCreate([
        { field: "id", type: "INTEGER", isKey: true },
        { field: "name", type: "TEXT", isNotNull: true },
        { field: "age", type: "INTEGER", isNotNull: true },
        { field: "height", type: "FLOAT" },
        { field: "weight", type: "FLOAT" },
    ]);
    expect(sql0).toMatchInlineSnapshot('"CREATE TABLE IF NOT EXISTS \\"test.db\\" (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, age INTEGER NOT NULL, height FLOAT, weight FLOAT);"');
});
test("select", () => {
    const sql1 = sqliteOrm
        .select()
        .where("name", "=", "张三")
        .and("age", "!=", "18")
        .or("name", "IN", ["张三", "李四", "王五"])
        .or("gex", "IS NOT", "男")
        .getSqlRaw();
    expect(sql1).toMatchInlineSnapshot('"SELECT * FROM \\"test.db\\" WHERE name=\\"张三\\" AND age!=\\"18\\" OR name IN (\\"张三\\",\\"李四\\",\\"王五\\") OR gex IS NOT \\"男\\" "');
    const sql2 = sqliteOrm
        .setTableName("my_table")
        .select("name,age")
        .and("name", ">", 18) // -> 等价于 where()
        .groupBy("name")
        .orderBy("DESC", "name,age")
        .limit(1, 2)
        .getSqlRaw();
    expect(sql2).toMatchInlineSnapshot('"SELECT name,age FROM \\"my_table\\" WHERE name>18 GROUP BY name ORDER BY name,age DESC LIMIT 1,2"');
    const sql3 = sqliteOrm.select().where("name", "IN", [1, 2, "hello"]).or("age", "=", 18).getSqlRaw();
    expect(sql3).toMatchInlineSnapshot('"SELECT * FROM \\"my_table\\" WHERE name IN (1,2,\\"hello\\") OR age=18 "');
    const sql4 = sqliteOrm
        .select()
        .whereArray("name", "=", [1, 2, "hello"], "AND")
        .or("age", "=", 18)
        .and("gex", "IN", [1, 2, 3])
        .andArray("gex", "!=", [1, "2", false])
        .getSqlRaw();
    expect(sql4).toMatchInlineSnapshot('"SELECT * FROM \\"my_table\\" WHERE ( name=1 AND name=2 AND name=\\"hello\\" ) OR age=18 AND gex IN (1,2,3) AND ( gex!=1 AND gex!=\\"2\\" AND gex!=0 ) "');
    const sql5 = sqliteOrm.count("id").where("age", ">", 18).and("gex", "=", "男").groupBy("name").getSqlRaw();
    expect(sql5).toMatchInlineSnapshot('"SELECT count(id) FROM \\"my_table\\" WHERE age>18 AND gex=\\"男\\" GROUP BY name "');
});
test("insert", () => {
    const sql6 = sqliteOrm.inser({
        name: "张三",
        age: 18,
        gex: "男",
        isFlag: true // -> true = 1, false = 0
    });
    expect(sql6).toMatchInlineSnapshot('"INSERT or REPLACE INTO \\"my_table\\" (name, age, gex, isFlag) VALUES (\\"张三\\", 18, \\"男\\", 1)"');
});
test("inserts", () => {
    const sql7 = sqliteOrm.insers(datas, 6); // 一个语句最多6个变量
    expect(sql7).toMatchInlineSnapshot(`
    [
      "INSERT or REPLACE INTO \\"my_table\\" (name, age, gex) VALUES (\\"张三\\", 18, \\"男\\"), (\\"李四\\", 16, \\"男\\")",
      "INSERT or REPLACE INTO \\"my_table\\" (name, age, gex) VALUES (\\"王五\\", 18, \\"女\\"), (\\"小明\\", 30, \\"男\\")",
      "INSERT or REPLACE INTO \\"my_table\\" (name, age, gex) VALUES (\\"小张\\", 22, \\"男\\")",
    ]
  `);
});
test("addColumn", () => {
    const sql8 = sqliteOrm.addColumn("new_name", "TEXT");
    expect(sql8).toMatchInlineSnapshot('"ALTER TABLE \\"my_table\\" ADD new_name TEXT;"');
});
test("tableInfo", () => {
    const sql9 = sqliteOrm.tableInfo();
    expect(sql9).toMatchInlineSnapshot('"SELECT * FROM \\"sqlite_master\\" WHERE type=\\"table\\" AND name=\\"my_table\\" "');
});
test("updateByWhen", () => {
    /**
     * 姓名修改为 name-age-gex 格式
     * 年龄增大10倍
     */
    const sql10 = sqliteOrm.buildUpdateByWhen({
        datas,
        onceMaxUpdateDataLength: 2,
        fieldOpts: [
            {
                setField: "name",
                getWhenField() {
                    return "name";
                },
                getWhenValue(row) {
                    return row.name;
                },
                getThenValue(row) {
                    return `${row.name}-${row.age}-${row.gex}`;
                },
            },
            {
                setField: "age",
                getWhenField() {
                    return "age";
                },
                getWhenValue(row) {
                    return row.age;
                },
                getThenValue(row) {
                    return row.age * 10;
                },
            }
        ]
    });
    expect(sql10).toMatchInlineSnapshot(`
    [
      "UPDATE \\"my_table\\" SET name = CASE WHEN name=\\"张三\\" THEN \\"张三-18-男\\" WHEN name=\\"李四\\" THEN \\"李四-16-男\\" END, age = CASE WHEN age=\\"18\\" THEN \\"180\\" WHEN age=\\"16\\" THEN \\"160\\" END",
      "UPDATE \\"my_table\\" SET name = CASE WHEN name=\\"王五\\" THEN \\"王五-18-女\\" WHEN name=\\"小明\\" THEN \\"小明-30-男\\" END, age = CASE WHEN age=\\"18\\" THEN \\"180\\" WHEN age=\\"30\\" THEN \\"300\\" END",
      "UPDATE \\"my_table\\" SET name = CASE WHEN name=\\"小张\\" THEN \\"小张-22-男\\" END, age = CASE WHEN age=\\"22\\" THEN \\"220\\" END",
    ]
  `);
});
test("setVersion", () => {
    const sql12 = sqliteOrm.setVersion(2);
    expect(sql12).toMatchInlineSnapshot('"PRAGMA user_version = 2"');
});
test("setVersion", () => {
    const sql12 = sqliteOrm.setVersion(2);
    expect(sql12).toMatchInlineSnapshot('"PRAGMA user_version = 2"');
});
describe("base methods", () => {
    test("findById", () => {
        const sql13 = sqliteOrm.findById(1);
        expect(sql13).toMatchInlineSnapshot('"SELECT * FROM \\"my_table\\" "');
    });
    test("selectAll", () => {
        const sql14 = sqliteOrm.selectAll();
        expect(sql14).toMatchInlineSnapshot('"DELETE FROM \\"my_table\\" WHERE id=1 "');
    });
    test("deleteById", () => {
        const sql15 = sqliteOrm.deleteById(1);
        expect(sql15).toMatchInlineSnapshot('"SELECT * FROM \\"my_table\\" "');
    });
    test("selectAll", () => {
        const sql16 = sqliteOrm.selectAll();
        expect(sql16).toMatchInlineSnapshot('"DROP TABLE IF EXISTS \\"hello.db\\""');
    });
    test("deleteTable", () => {
        const sql17 = sqliteOrm.deleteTable("hello.db");
        expect(sql17).toMatchInlineSnapshot();
    });
});
