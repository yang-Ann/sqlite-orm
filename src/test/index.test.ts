import SqliteOrm from "../SqliteOrm.js";
// vitest: https://cn.vitest.dev/guide/
import { test, expect, describe } from "vitest";

const sqliteOrm = new SqliteOrm({ tableName: "test.db" });

type Persion = {
  name: string;
  age: number;
  gex: "男" | "女";
};

const datas: Persion[] = [
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

  expect(sql0).toMatchSnapshot('"CREATE TABLE IF NOT EXISTS \\"test.db\\" (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, age INTEGER NOT NULL, height FLOAT, weight FLOAT);"');
});

test("select", () => {
  const sql1 = sqliteOrm
    .select()
    .where("name", "=", "张三")
    .and("age", "!=", "18")
    .or("name", "IN", ["张三", "李四", "王五"])
    .or("gex", "IS NOT", "男")
    .getSqlRaw();

  expect(sql1).toMatchSnapshot();

  const sql2 = sqliteOrm
    .setTableName("my_table")
    .select("name,age")
    .and("name", ">", "张三") // -> 丢失 AND 等价于 where()
    .groupBy("name")
    .orderBy("DESC", "name,age")
    .limit(10, 15)
    .fillValue(false) // -> 会改变本次调用的值填充模式, 可以在任意时刻调用
    .or("gex", "=", "男")
    .andArray("ids", "IN", [1, 2, 3])
    .and("uuids", "IN", [1, 2, 3])
    .getSqlRaw();

  // expect(sql2).toMatchSnapshot();

  expect(sql2).toMatchInlineSnapshot('"SELECT name,age FROM \\"my_table\\" WHERE name>\\"张三\\" OR gex=\\"男\\" AND ( ids IN 1 AND ids IN 2 AND ids IN 3 ) AND uuids IN (1, 2, 3) GROUP BY name ORDER BY DESC name,age LIMIT 10,15"');


  const sql3 = sqliteOrm.select().where("name", "IN", [1, 2, "hello"]).or("age", "=", 18).getSqlRaw();
  expect(sql3).toMatchSnapshot();


  const sql4 = sqliteOrm
  .select()
  .whereArray("name", "=", [1, 2, "hello"], "AND")
  .or("age", "=", 18)
  .and("gex", "IN", [1, 2, 3])
  .andArray("gex", "!=", [1, "2", false])
  .getSqlRaw();

  expect(sql4).toMatchSnapshot();


  const sql5 = sqliteOrm.count("id").where("age", ">", 18).and("gex", "=", "男").groupBy("name").getSqlRaw();
  expect(sql5).toMatchSnapshot();
});


test("insert", () => {
  const sql6 = sqliteOrm.inser<Persion & { isFlag: boolean }>({
    name: "张三",
    age: 18,
    gex: "男",
    isFlag: true // -> true = 1, false = 0
  });
  expect(sql6).toMatchSnapshot();
});


test("inserts", () => {
  const sql7 = sqliteOrm.insers<Persion[]>(datas, 6); // 一个语句最多6个变量
  expect(sql7).toMatchSnapshot();
});

test("addColumn", () => {
  const sql8 = sqliteOrm.addColumn("new_name", "TEXT");
  expect(sql8).toMatchSnapshot('"ALTER TABLE \\"my_table\\" ADD new_name TEXT;"');
});

test("tableInfo", () => {
  const sql9 = sqliteOrm.tableInfo();
  expect(sql9).toMatchSnapshot();
});

test("updateByWhen", () => {
  /**
   * 姓名修改为 name-age-gex 格式
   * 年龄增大10倍
   */
  const sql10 = sqliteOrm.buildUpdateByWhen({
    datas,
    onceMaxUpdateDataLength: 2, // 一个语句最多更新2条数据
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
  expect(sql10).toMatchSnapshot();
});


test("setVersion", () => {
  const sql12 = sqliteOrm.fillValue(false).setVersion(2);
  expect(sql12).toMatchSnapshot();
});

describe("base methods", () => {

  test("findById", () => {
    const sql13 = sqliteOrm.findById(1);
    expect(sql13).toMatchSnapshot();
  });

  test("selectAll", () => {
    const sql14 = sqliteOrm.selectAll();
    expect(sql14).toMatchSnapshot();
  });

  test("deleteById", () => {
    const sql15 = sqliteOrm.deleteById(1);
    expect(sql15).toMatchSnapshot();
  });

  test("deleteAll", () => {
    const sql16 = sqliteOrm.deleteAll();
    expect(sql16).toMatchSnapshot();
  });

  test("deleteTable", () => {
    const sql17 = sqliteOrm.deleteTable("hello.db");
    expect(sql17).toMatchSnapshot();
  });
  
});