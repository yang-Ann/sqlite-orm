import { openDatabase, enablePromise, DEBUG } from "react-native-sqlite-storage";
import type { DatabaseParams, SQLiteDatabase, ResultSet, Transaction, SQLError } from "react-native-sqlite-storage";
import RNFS from "react-native-fs";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DeviceInfo from "react-native-device-info";

import { TableFieldsOption, DataType, MyObject, WhereType, BuildUpdateByWhenOption } from "./types";
import SqliteOrm from "./SqliteOrm";

/** 开启SQLinte 官方debug */
// DEBUG(__DEV__);

type P<T = ResultSet> = Promise<T>;

// 表格信息类型
export type TableInfoType = {
  /** 表名 */
  name: string;
  rootpage: number;
  /** 创建时的sql */
  sql: string;
  /** 表名 */
  tbl_name: string;
  /** 类型 */
  type: string;
  /** 版本信息 */
  version?: number;
  /** 从 sql 中解析出来的字段 */
  sqlFieldList: TableFieldsOption[];
};

/** sqlite 自定义查询参数类型, 对应 getByCustom() 的参数类型 */
export type SqliteCustomQueryParamsType<T = any> = [
  query: Partial<T>,
  where?: WhereType,
  queryFields?: string,
  group?: string
];

/** 开启 Promise 返回值操作 */
enablePromise(true);

/** 日志输出 */
const IS_LOG = __DEV__;
// const IS_LOG = false;

/** 不等于正则匹配 */
const notRE = /^\$NOT_/;

// 不同系统版本的坑
const systemVersion = DeviceInfo.getSystemVersion();
if (systemVersion === "11") {
  console.warn(
    "当前 Android系统版本是11, 如果碰到 sql 执行没有返回值的情况, \n请检查是否注释掉 react-native.config.js 里的 react-native-sqlite-storage 配置"
  );
}

/**
 * sqlite 操作类
 * 需要注意的是在 Androd 11下需要注释掉 react-native.config.js 里面 dependencies["react-native-sqlite-storage"] 的配置, 不然就会无法执行 sql 语句
 */
class SqliteHelper {
  /** sql连接对象, 通过 SqliteHelper.getDBConnect() 获取 */
  public db: SQLiteDatabase | null = null;

  // sqlite orm 对象
  public sqliteOrm: SqliteOrm;

  public constructor(
    /** react-native-sqlite-storage 的配置 */
    public databaseParams: DatabaseParams,

    /** 表格字段配置, 特意写成数组(写成对象顺序, for...in 无法保证顺序) */
    public fieldsOption: TableFieldsOption[],

    /** 数据库版本 */
    public databaseVersion = 1,

    /** 默认查询的字段 */
    public queryFields = "*"
  ) {
    this.sqliteOrm = new SqliteOrm({ tableName: databaseParams.name, isFillValue: true });
  }

  /**
   * 初始化
   */
  public async init(): Promise<SqliteHelper | Error> {
    return new Promise(async (resolve, reject) => {
      try {
        /**
         * 打开数据库连接, 在 Android11 情况下, 打开则会立刻生成 .db-journal 文件, 而非 Android11 则是在创建表成功之后才会生成 .db-journal 文件
         */
        this.db = await openDatabase(this.databaseParams);
        console.log(`${this.tableName} 打开成功: `, this.db);
        const isTable = await this.isTableExist();

        const done = () => {
          this.saveDBVersionInfo();
          resolve(this);
        };

        // TODO 可以使用 PRAGMA user_version = xxx 来设置版本号, 在表信息的 sql 中获取
        const dbv = await AsyncStorage.getItem(this.DBVersionKey);
        // 是否需要升级
        const isUpdate = this.databaseVersion > Number(dbv);

        if (isTable) {
          console.log(`${this.tableName} 已经存在`);

          if (dbv) {
            if (isUpdate) {
              console.log(`${this.tableName} 数据库版本变更, 旧的版本（${dbv}） -> 新版本（${this.databaseVersion}）`);
              await this.repairNativeField();
              await this.updateVersion(Number(dbv), this.databaseVersion);
            } else {
              console.log(`${this.tableName} 是最新版本`);
              await this.repairNativeField();
            }
          } else {
            console.warn(`${this.tableName}数据库没有版本信息`);
            await this.repairNativeField();
            await this.updateVersion(Number(dbv), this.databaseVersion);
          }
        } else {
          console.log(`========== 创建 ${this.tableName} 数据库 ==========`);
          await this.createTable();
          // 创建完成数据后也加上字段判断, 避免出现问题
          await this.repairNativeField();
        }
        done();
      } catch (error) {
        if (error instanceof Error) {
          reject(error.message);
        } else {
          reject("数据库连接失败了" + error);
        }
      }
    });
  }

  /** 保存本地数据库版本信息 */
  public saveDBVersionInfo() {
    const version = this.databaseVersion.toString();
    AsyncStorage.setItem(this.DBVersionKey, version)
      .then(() => {
        console.log(`${this.tableName} 版本信息存储成功`, version);
      })
      .catch(err => {
        console.log("sqlite 版本信息存储失败: ", err);
      });
  }

  /**
   * 如果本地存在表数据, 该方法可以比较本地数据和 thsi.fieldsOption 里面的字段,
   * 如果新增了则会自动添加(减少了不管), 补充本地字段信息
   * 注意: 当数据版本升级时(updateVersion)同样会触发这个方法
   * @returns
   */
  public repairNativeField() {
    return new Promise(async (resolve, reject) => {
      try {
        console.log(`================${this.tableName}比较字段信息================`);
        const tableRes = await this.tableInfo();
        console.log("tableRes ", tableRes);
        if (tableRes && tableRes.sqlFieldList) {
          const addFields = this.fieldsOption.filter(e => tableRes.sqlFieldList.every(item => item.field !== e.field));
          if (addFields.length) {
            console.log(
              `================这些是${this.tableName}表的新增字段信息================`,
              addFields,
              this,
              tableRes
            );
            const copyFiels: TableFieldsOption[] = JSON.parse(JSON.stringify(addFields));
            copyFiels.forEach(e => {
              if (e.isNotNull || e.isKey) {
                console.warn(`该${e.field}字段是新增的, 修改为非主键, 可以为空`, e);
                e.isNotNull = false;
                e.isKey = false;
              }
            });
            await this.addColumns(copyFiels);
          } else {
            console.log(`${this.tableName}表没有需要新增的字段信息`);
          }
        } else {
          console.warn(`${this.tableName}对比数据库字段失败, 表数据没有获取到`, tableRes);
        }
        resolve(null);
      } catch (err) {
        console.log(`${this.tableName}表比较字段信息报错了: `, err);
        // 这里不能 reject 否则数据库就初始化不成功
        resolve(err);
      }
    });
  }

  /**
   * 表名
   */
  get tableName() {
    return this.databaseParams.name;
  }

  /** 本地sqlite存储的版本信息key */
  get DBVersionKey() {
    return `SQLITE_VERSION_${this.databaseParams.name}`;
  }

  /**
   * 判断指定目录下是否存在本地数据库
   * @param dir 本地目录(前提是要把 sqlite 创建到 databases 目录下面)
   * @returns
   */
  public isTableExist(dir = "databases") {
    return new Promise(async resolve => {
      try {
        const mainDir = RNFS.DocumentDirectoryPath.replace(/\/files$/, "");
        // .db-journal 文件
        const journalPath = `${mainDir}/${dir}/${this.tableName}-journal`;
        const isJournalExist = await RNFS.exists(journalPath);

        // .db 文件
        const dbPath = `${mainDir}/${dir}/${this.tableName}`;
        const isDbExist = await RNFS.exists(dbPath);

        const isExist = isJournalExist || isDbExist;

        const tableRes = await this.tableInfo();
        // 存在数据库文件存在并且本地还有表信息
        resolve(isExist && Boolean(tableRes));
      } catch (err) {
        resolve(false);
      }
    });
  }

  /**
   * 创建数据库
   */
  public createTable() {
    const [sql, params] = this.sqliteOrm.buildCreate(this.fieldsOption);
    return this.executeSql(sql, params);
  }

  /**
   * 新增列, 重复添加相同的列会报错
   * @param fieldOpt 新增的字段信息
   * @returns
   */
  public addColumn(fieldOpt: Omit<TableFieldsOption, "isKey" | "isNotNull">) {
    return new Promise(async (resolve, reject) => {
      try {
        const tableRes = await this.tableInfo();
        console.log("tableRes: ", tableRes);
        if (tableRes) {
          if (tableRes.sqlFieldList.length) {
            if (tableRes.sqlFieldList.some(e => e.field === fieldOpt.field)) {
              resolve(`${fieldOpt.field}字段已经存在`);
            } else {
              const { field, type } = fieldOpt;
              const [sql, params] = this.sqliteOrm.addColumn(field, type);
              const [res] = await this.executeSql(sql, params);
              resolve(res);
            }
          } else {
            resolve("未提取到 sql 字段信息: " + tableRes.sql);
          }
        } else {
          resolve("表还未创建, 无法添加字段");
        }
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * 一次添加多个列
   * @param fieldOpts 新增的字段信息
   * @returns
   */
  public addColumns(fieldOpts: Omit<TableFieldsOption, "isKey" | "isNotNull">[]) {
    const execs = fieldOpts.map(item => this.addColumn(item));
    return Promise.all(execs);
  }

  /**
   * 删除列, 一次删除删除一个字段
   * http://www.sqlite.org/faq.html#q11
   * // https://blog.csdn.net/stan1989/article/details/8570187
   * @param field 删除的字段
   * @returns
   */
  public deleteColumn(field: string) {
    return new Promise(async (resolve, reject) => {
      try {
        const tableRes = await this.tableInfo();
        console.log("tableRes: ", tableRes);
        if (tableRes && tableRes.sqlFieldList.length) {
          if (tableRes.sqlFieldList.some(e => e.field === field)) {
            // 过滤需要删除的字段配置
            const tempTableFieldsOption = this.fieldsOption.filter(e => e.field !== field);
            if (tempTableFieldsOption.length === 0) {
              console.warn("已经是最后一个字段, 无法删除: ", this);
              reject("已经是最后一个字段, 无法删除");
            }

            if (!this.db) {
              reject("还没有初始化数据库连接");
              return;
            }
            resolve("TODO 待优化");
            return;

            // TODO 开启事务
            // this.db.transaction(async tx => {
            //   tx.executeSql("")
            // });

            // 创建临时表
            const tempDatabaseParams: DatabaseParams = JSON.parse(JSON.stringify(this.databaseParams));
            tempDatabaseParams.name = tempDatabaseParams.name.replace(/\.db$/, `_temp_${this.databaseVersion}.db`);
            const tempTable = new SqliteHelper(tempDatabaseParams, tempTableFieldsOption);
            await tempTable.init();

            // TODO (报错)将数据从目标表保存到临时表中
            // const fields = tempTableFieldsOption.map(e => e.field).join(",");
            // const cpSql1 = `INSERT INTO "${tempDatabaseParams.name}" (${fields}) SELECT ${fields} FROM "${this.tableName}"`;
            // await tempTable.executeSql(cpSql1);

            // 手动插入
            // await tempTable.inserts(await this.getList());

            const backData = await tempTable.getList();
            console.log("备份的数据: ", backData);

            // 删除目标表
            await this.deleteTable();

            // 重新创建目标表
            this.fieldsOption = tempTableFieldsOption;
            await this.init();
            console.log("重新创建目标表");

            // TODO (报错) 将数据从临时表保存到目标表中
            // const cpSql2 = `INSERT or REPLACE INTO "${this.tableName}" (${fields}) SELECT ${fields} FROM "${tempTable.tableName}"`;
            // await this.executeSql(cpSql2);

            // 手动插入
            // await this.inserts(await tempTable.getList());

            // 删除临时表
            await tempTable.deleteTable();
            resolve(null);
          } else {
            console.warn(field + " 字段不在这个表中 -> ", tableRes);
            reject("字段不在配置里面");
          }
        } else {
          console.warn("表还没创建", this);
          reject("表还没创建");
        }
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * 获取主键的字段名
   */
  public getFieldKey() {
    const target = this.fieldsOption.find(e => e.isKey);
    if (target) {
      return target.field;
    } else {
      throw new Error(`没有获取到主键, 请检查 fieldsOption 配置: ${this.fieldsOption}`);
    }
  }

  /**
   * 获取所有的字段信息, 会自动拼接 字段和对应的值填充语句
   */
  public getFields() {
    // 要把自增的主键剔除
    return this.fieldsOption.filter(e => !e.isKey).map(e => e.field);
  }

  /**
   * 获取数据的信息
   * @param data 数据
   * @param deleteKey deleteKey: 是否剔除主键
   * @returns
   */
  public getDataInfo(data: MyObject, deleteKey = true) {
    // 提前声明的字段(就是创建表时给的字段)
    let _fields: string[] = [];

    // 字段数据
    let fields = [];
    const map: any = {};

    // 是否删除主键
    if (deleteKey) {
      _fields = this.getFields();
    } else {
      _fields = this.fieldsOption.map(e => e.field);
    }
    fields = Object.keys(data).filter(e => _fields.includes(e));
    // 值 数据
    const values = [];
    for (const key of fields) {
      const val = data[key];
      map[key] = val;
      values.push(val);
    }
    if (IS_LOG) {
      console.groupCollapsed("字段数据: ");
      console.log("提前声明的字段: ", _fields);
      console.log("本次数据字段: ", fields);
      console.groupEnd();
    }
    return { fields, values, map };
  }

  /**
   * 关闭数据库
   */
  public close() {
    return this.db?.close();
  }

  /**
   * 解析 sql 查询返回值为数组
   * @param results T[]
   * @returns
   */
  public buildRet<T extends any[] = any[]>(results: [ResultSet]): T {
    const list: any[] = [];
    results.forEach(result => {
      for (let i = 0; i < result.rows.length; i++) {
        list.push(result.rows.item(i));
      }
    });
    return list as T;
  }

  private $buildUpdateByWhen(sql: string, params: any[]) {
    return new Promise<ResultSet>((resolve, reject) => {
      this.executeSql(sql, params)
        .then(res => {
          resolve(res[0]);
        })
        .catch(err => {
          resolve(err);
        });
    });
  }

  /**
   * 执行 update when 语句(支持大数据量, 内部会做切分执行)
   */
  public buildUpdateByWhen<T = any>(opt: BuildUpdateByWhenOption<T>) {
    return new Promise<ResultSet[]>(async (resolve, reject) => {
      try {
        const result: ResultSet[] = [];
        const sqlExces = this.sqliteOrm.buildUpdateByWhen(opt).map(([sql, params]) => {
          return this.$buildUpdateByWhen(sql, params);
        });

        const resList = await Promise.allSettled(sqlExces);
        for (let i = 0; i < resList.length; i++) {
          const item = resList[i];
          if (item.status === "fulfilled") {
            console.log(`第${i + 1}次更新的数据: `, item);
            result.push(item.value);
          } else {
            console.error(`第${i + 1}次的切片数据更新失败:`, item.reason);
          }
        }
        resolve(result);
      } catch (err) {
        console.log("err: ", err);
        reject(err);
      }
    });
  }

  /**
   * 包装 executeSql 方法, 输出日志
   * @param statement sql 语句
   * @param params 数据值
   * @returns
   */
  // public executeSql(...args: Parameters<typeof this.db.executeSql>) { // TODO 获取的是重载的类型
  public executeSql(statement: string, params?: any[]) {
    // 输出日志, 方便调试
    if (IS_LOG) {
      console.groupCollapsed("executeSql");
      console.log("sql: ", statement);
      console.log("params: ", params);
      console.groupEnd();
    }

    if (this.db) {
      // BUG Android11 的情况下, 必须要把 react-native.config.js 里的 dependencies["react-native-sqlite-storage"] 注释掉不然这里不会有返回值
      return this.db.executeSql(statement, params);
    } else {
      throw new Error("还没有初始化数据库连接, 请先执行 init 方法");
    }
  }

  /**
   * 获取所有的数据
   * @param queryFields 查询显示的字段, 默认: *
   * @returns
   */
  public getList<T extends MyObject[] = MyObject[]>(queryFields = this.queryFields): P<T> {
    return new Promise(async (resolve, reject) => {
      try {
        const [sql, params] = this.sqliteOrm.select(queryFields).getSqlRaw();
        const results = await this.executeSql(sql, params);
        const list = this.buildRet<T>(results);
        resolve(list);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * 获取数据总数
   * @returns
   */
  public getTableCount<T extends MyObject = MyObject>(
    countKey?: string,
    where?: Partial<T>,
    flog: WhereType = "AND"
  ): P<number> {
    return new Promise(async (resolve, reject) => {
      try {
        const key = countKey || this.getFieldKey();
        const { fields, values } = this.getDataInfo(where || {});
        this.sqliteOrm.count(key);
        fields.forEach((f, i) => {
          const val = values[i];
          if (flog === "AND") {
            this.sqliteOrm.and(f, "=", val);
          } else {
            this.sqliteOrm.or(f, "=", val);
          }
        });
        const [sql, params] = this.sqliteOrm.getSqlRaw();
        const results = await this.executeSql(sql, params);
        const [res] = this.buildRet(results);
        resolve(res[`count(${key})`]);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * 根据主键进行获取
   * @param id 主键
   * @param queryFields 查询显示的字段, 默认: *
   * @returns
   */
  public getById<T extends object = MyObject>(id: any, queryFields = this.queryFields): P<T> {
    return new Promise(async (resolve, reject) => {
      try {
        const key = this.getFieldKey();
        const [sql, params] = this.sqliteOrm.select(queryFields).where(key, "=", id).getSqlRaw();
        const results = await this.executeSql(sql, params);
        const list = this.buildRet(results);

        // 只要第1条
        const data = list.length > 0 ? list[0] : list;
        if (list.length > 1) {
          console.error("获取到多条数据: ", list);
          throw new Error("获取到多条数据");
        }
        resolve(data.length === 0 ? null : data);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * 查询数据(自定义字段和数据)
   * @param query 查询的数据
   * @param flog AND 或者 OR, 默认: AND
   * @param queryFields 需要显示的字段, 默认: *
   * @param group 分组字段
   * @returns T[]
   */
  public getByCustom<T extends MyObject = MyObject>(
    query: Partial<T>,
    flog: WhereType = "AND",
    queryFields = this.queryFields,
    group = ""
  ): P<T[]> {
    return new Promise(async (resolve, reject) => {
      try {
        const { fields, values } = this.getDataInfo(query);
        this.sqliteOrm.select(queryFields);
        fields.forEach((f, i) => {
          const val = values[i];
          if (flog === "AND") {
            this.sqliteOrm.and(f, "=", val);
          } else {
            this.sqliteOrm.or(f, "=", val);
          }
        });
        const [sql, params] = this.sqliteOrm.groupBy(group).getSqlRaw();
        const results = await this.executeSql(sql, params);
        const list = this.buildRet<T[]>(results);
        resolve(list);
      } catch (error) {
        reject(error);
      }
    });
  }

  /** 根据数组查询数据 */
  public getByArray<T extends MyObject[] = MyObject[]>(
    data: Array<string | number>,
    key: string,
    flog: WhereType = "OR"
  ): P<T> {
    return new Promise(async (resolve, reject) => {
      try {
        const [sql, params] = this.sqliteOrm.select().whereArray(key, "=", data, flog).getSqlRaw();
        const results = await this.executeSql(sql, params);
        const list = this.buildRet<T>(results);
        resolve(list);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * 插入单条数据
   * @param data T
   * @returns
   */
  public insert<T extends object = MyObject>(data: Partial<T>): P<ResultSet> {
    return new Promise(async (resolve, reject) => {
      try {
        const [sql, params] = this.sqliteOrm.inser(data);
        const [res] = await this.executeSql(sql, params);
        resolve(res);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * 插入多条数据, 数据中可以包含主键的值会被自动忽略, 因为 sqlite 一次不能超过 999 个值填充变量,
   *  内部会根据 `fieldsOption` 里的字段, 自动进行数据的分段保存
   * @param datas T[]
   * @returns
   */
  public inserts<T extends MyObject[] = MyObject[]>(datas: T, maxSize = 999): P<ResultSet[]> {
    return new Promise(async (resolve, reject) => {
      try {
        const sqls = this.sqliteOrm.insers(datas, maxSize);

        const result: ResultSet[] = [];

        // 所有的数据
        const taskList = sqls.map(([sql, params]) => this.executeSql(sql, params));
        const resList = await Promise.allSettled(taskList);

        for (let i = 0; i < resList.length; i++) {
          const item = resList[i];
          if (item.status === "fulfilled") {
            console.log(`第${i + 1}次保存的数据: `, item);
            result.push(item.value);
          } else {
            console.error(`第${i + 1}次的切片数据保存失败:`, item.reason);
          }
        }
        resolve(result);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * 根据主键更新数据
   * @param data T, 数据里必须要有主键(isKey: true)
   * @returns
   */
  public updateById<T extends object = MyObject>(data: Partial<T>): P {
    return new Promise(async (resolve, reject) => {
      try {
        const json = JSON.parse(JSON.stringify(data));
        const key = this.getFieldKey();
        // 拿到主键的值
        const keyVal = json[key];
        if (!keyVal) throw new Error(`${data}里面没有主键(${key})的值, 请检查`);
        // 删除主键的值
        delete json[key];
        const { map } = this.getDataInfo(json);
        const [sql, params] = this.sqliteOrm.update(map).where(key, "=", keyVal).getSqlRaw();
        const [res] = await this.executeSql(sql, params);
        resolve(res);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * 更新数据根据自定义字段
   * @param data 更新的数据
   * @param where where 条件数据
   * @param flog AND 或者 OR, 默认: AND
   * @returns
   */
  public updateByCustom<T extends object = MyObject>(data: Partial<T>, where: MyObject, flog: WhereType = "AND"): P {
    return new Promise(async (resolve, reject) => {
      try {
        // 值填充符
        const { fields, values, map } = this.getDataInfo(where);
        this.sqliteOrm.update(map);
        fields.forEach((e, i) => {
          const val = values[i];
          if (flog === "AND") {
            this.sqliteOrm.and(e, "=", val);
          } else {
            this.sqliteOrm.or(e, "=", val);
          }
        });
        const [sql, params] = this.sqliteOrm.getSqlRaw();
        const [res] = await this.executeSql(sql, params);
        resolve(res);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * 根据主键删除数据
   * @param id 主键
   * @returns
   */
  public deleteById(id: string | number): P {
    return new Promise(async (resolve, reject) => {
      try {
        const key = this.getFieldKey();
        const [sql, params] = this.sqliteOrm.delete().where(key, "=", id).getSqlRaw();
        const [res] = await this.executeSql(sql, params);
        resolve(res);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * 删除数据(根据自定义字段)
   * @param query 查询条件数据
   * @param flog AND 或者 OR, 默认: AND
   * @returns
   */
  public deleteByCustom<T extends object = MyObject>(query: Partial<T>, flog: WhereType = "AND"): P {
    return new Promise(async (resolve, reject) => {
      try {
        const { fields, values } = this.getDataInfo(query);
        this.sqliteOrm.delete();
        fields.forEach((e, i) => {
          const val = values[i];
          if (flog === "AND") {
            this.sqliteOrm.and(e, "=", val);
          } else {
            this.sqliteOrm.or(e, "=", val);
          }
        });
        const [sql, params] = this.sqliteOrm.getSqlRaw();
        const [res] = await this.executeSql(sql, params);
        resolve(res);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * 删除数据(根据自定义字段)
   */
  public deleteByArray<T extends string | number = string>(data: T[], key: string, flog: WhereType = "OR"): P {
    return new Promise(async (resolve, reject) => {
      try {
        const [sql, params] = this.sqliteOrm.delete().whereArray(key, "=", data, flog).getSqlRaw();
        const [res] = await this.executeSql(sql, params);
        resolve(res);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * 请空表数据
   */
  public clearTable(): P {
    return new Promise(async (resolve, reject) => {
      try {
        const [sql, params] = this.sqliteOrm.deleteAll();
        const [res] = await this.executeSql(sql, params);
        resolve(res);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * 删除表
   */
  public deleteTable(): P {
    return new Promise(async (resolve, reject) => {
      try {
        const [sql, params] = this.sqliteOrm.deleteTable();
        const [res] = await this.executeSql(sql, params);
        resolve(res);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * 通用事务操作, 事务只负责执行, 里面不能执行异步操作
   * https://github.com/storesafe/cordova-sqlite-storage#using-draft-standard-transaction-api
   * @param opt
   * @returns
   */
  public transaction(opt: {
    /** 处理回调 */
    handleCallback: (tx: Transaction, sqliteOrm: SqliteOrm) => void;

    /** 事务发生错误时触发 */
    transactionSuccess?: () => void;

    /** 事务发生错误时触发 */
    transactionError?: (err: SQLError) => void;
  }) {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject("数据库初始化失败");
        return;
      }

      // 开启事务
      this.db.transaction(
        tx => {
          opt.handleCallback(tx, this.sqliteOrm);
        },
        // 事务操作失败
        error => {
          opt.transactionError && opt.transactionError(error);
        },
        // 事务操作成功
        () => {
          opt.transactionSuccess && opt.transactionSuccess();
        }
      );
    });
  }

  /**
   * 当前表信息
   * `TODO 只有表里面有数据时才会获取到表格信息`
   */
  public tableInfo(): P<TableInfoType | null> {
    return new Promise(async resolve => {
      try {
        const [sql, params] = this.sqliteOrm.tableInfo();
        const r = await this.executeSql(sql, params);
        const [tableRes] = this.buildRet<Omit<TableInfoType, "version" | "sqlFieldList">[]>(r);
        if (!tableRes) {
          resolve(null);
          return;
        }

        // 当前数据库版本
        const version = await AsyncStorage.getItem(`SQLITE_VERSION_${tableRes.tbl_name}`);

        // 已经创建的表的字段信息
        const sqlFieldList: TableFieldsOption[] = [];

        const re = /(?<fieldStr>\(.*?\))/gs;
        // tableRes.sql 类似如下的值
        // "CREATE TABLE \"test.db\" (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, age INTEGER NOT NULL, height FLOAT, weight FLOAT, hello TEXT)"
        const execRes = re.exec(tableRes.sql);
        if (execRes?.groups) {
          const fieldStr = execRes.groups.fieldStr;

          const allFields = fieldStr
            .slice(1, fieldStr.length - 1) // TODO 这里没有兼容sqlite设置的版本号
            // 逗号切分
            .split(",");

          allFields.forEach(e => {
            const isKey = e.indexOf("PRIMARY KEY") !== -1;
            const isNotNull = e.indexOf("NOT NULL") !== -1;
            const [field, type] = e.trim().split(" ");
            sqlFieldList.push({
              field,
              type: type as DataType,
              isKey,
              isNotNull
            });
          });
        }

        const result: TableInfoType = {
          ...tableRes,
          version: Number(version),
          sqlFieldList
        };
        resolve(tableRes ? result : null);
      } catch (error) {
        resolve(null);
      }
    });
  }

  /**
   * 所有的表信息
   * - `TODO 只有表里面有数据时才会获取到表格信息`
   */
  public allTableInfo(): P<TableInfoType[]> {
    return new Promise(async (resolve, reject) => {
      try {
        const temp = new SqliteOrm({ tableName: "sqlite_master", isFillValue: true });
        const [sql, params] = temp.select().where("type", "=", "table").getSqlRaw();
        const r = await this.executeSql(sql, params);
        const res = this.buildRet(r);

        // 过滤系统和第三方库的表
        const tableList = res.filter(e => !["android_metadata", "sqlite_sequence"].includes(e.tbl_name));

        const exces = tableList.map(e => {
          return AsyncStorage.getItem(`SQLITE_VERSION_${e.tbl_name}`);
        });

        const resList = await Promise.all(exces);

        const map = resList.map((e, i) => {
          return {
            ...tableList[i],
            version: Number(e)
          };
        });
        resolve(map);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * sqlite 版本升级
   * 需要自己重写逻辑
   */
  public async updateVersion(oldVersion: number, newVersion: number) {
    return Promise.resolve();
  }

  /**
   * 创建导出文件数据目录
   */
  public static async createDataFileDir(): P<string> {
    return new Promise(async (resolve, reject) => {
      try {
        console.log("RNFS: ", RNFS);
        const destDir = `${RNFS.DownloadDirectoryPath}/szzc_pda_databases_file`;
        const exists = await RNFS.exists(destDir);
        if (!exists) {
          console.log("创建", destDir, "目录");
          await RNFS.mkdir(destDir);
        }
        resolve(destDir);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * 将表复制到指定目录
   */
  public async exportDbFile(): P<string> {
    return new Promise(async (resolve, reject) => {
      try {
        const res = await this.tableInfo();
        if (!res) {
          reject("表还未创建");
          return;
        }
        const dbFile = `${RNFS.DocumentDirectoryPath.replace(/\/files$/, "/databases")}/${res.tbl_name}`;
        const destDir = await SqliteHelper.createDataFileDir();
        const destDbFile = `${destDir}/${res.tbl_name.replace(/\.db$/, `_${res.version}.db`)}`;
        // 直接拷贝数据库文件
        await RNFS.copyFile(dbFile, destDbFile);
        resolve(destDbFile);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * 将表数据导出到 JSON 文件
   */
  public async exportJsonFile(): P<string> {
    return new Promise(async (resolve, reject) => {
      try {
        const res = await this.tableInfo();
        if (!res) {
          reject("表还未创建");
          return;
        }
        const destDir = await SqliteHelper.createDataFileDir();
        const destJsonFile = `${destDir}/${res.tbl_name.replace(/\.db$/, `_${res.version}.json`)}`;
        const dataList = await this.getList();
        await RNFS.writeFile(destJsonFile, JSON.stringify(dataList, null, 2));
        resolve(destJsonFile);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * 将表数据导出成 sql 文件
   */
  public async exportSqlFile(): P<string> {
    return new Promise(async (resolve, reject) => {
      try {
        const res = await this.tableInfo();
        if (!res) {
          reject("表还未创建");
          return;
        }
        const destDir = await SqliteHelper.createDataFileDir();
        const destSqlFile = `${destDir}/${res.tbl_name.replace(/\.db$/, `_${res.version}.sql`)}`;

        const exists = await RNFS.exists(destSqlFile);
        if (exists) {
          console.log("删除", destDir, "文件");
          await RNFS.unlink(destSqlFile);
        }

        RNFS.appendFile(destSqlFile, "-- create table\n");
        RNFS.appendFile(destSqlFile, res.sql + "\n\n");

        const dataList = await this.getList();
        const [sql, params] = this.sqliteOrm.insers(dataList);
        RNFS.appendFile(destSqlFile, "-- insert\n");
        RNFS.appendFile(destSqlFile, sql + "\n\n");

        RNFS.appendFile(destSqlFile, "-- insert datas\n");
        RNFS.appendFile(destSqlFile, JSON.stringify(params) + "\n\n");
        resolve(destSqlFile);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * 导出本地所有的 .db 数据库文件
   */
  public static async exportNativeAllDbFile() {
    return new Promise(async (resolve, reject) => {
      try {
        const destDir = await SqliteHelper.createDataFileDir();
        const dbFileDir = `${RNFS.DocumentDirectoryPath.replace(/\/files$/, "/databases")}`;
        const exists = await RNFS.exists(destDir);
        if (!exists) {
          console.log("创建", destDir, "目录");
          await RNFS.mkdir(destDir);
        }
        const dirs = await RNFS.readDir(dbFileDir);
        for (const item of dirs) {
          if (item.path.endsWith(".db")) {
            const fileName = item.path.split("/").pop();
            if (fileName) {
              // 直接拷贝数据库文件
              console.log(`${item.path} -> ${destDir}/${fileName}`);
              await RNFS.copyFile(item.path, `${destDir}/${fileName}`);
            }
          }
        }
        resolve(destDir);
      } catch (error) {
        reject(error);
      }
    });
  }
}

export default SqliteHelper;
